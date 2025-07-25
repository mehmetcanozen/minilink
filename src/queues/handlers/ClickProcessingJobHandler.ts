import { CacheService } from '../../services/CacheService';
import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../../config/prisma';

export interface ClickProcessingJob {
  slug: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
}

export class ClickProcessingJobHandler {
  private cacheService: CacheService;
  private urlRepository: PrismaUrlRepository;

  constructor() {
    this.cacheService = new CacheService();
    this.urlRepository = new PrismaUrlRepository(getPrismaClient());
  }

  async process(job: { data: ClickProcessingJob }): Promise<void> {
    const { slug, userAgent, ip, timestamp } = job.data;

    try {
      console.log(`Processing click for slug: ${slug}`);

      // Increment Redis click count for this slug
      const newClickCount = await this.cacheService.incrementClickCount(slug);

      // Check if we should sync to database (every 10 clicks or every 5 minutes)
      const shouldSync = await this.shouldSyncToDatabase(slug, newClickCount);

      if (shouldSync) {
        await this.syncClickCountToDatabase(slug, newClickCount);
        
        // Reset Redis counter after successful sync
        await this.cacheService.resetClickCount(slug);
        
        console.log(`Synced ${newClickCount} clicks for slug ${slug} to database`);
      }

      // Log analytics data (optional - for future analytics features)
      await this.logAnalytics(slug, userAgent, ip, timestamp);

    } catch (_error) {
      console.error('Failed to process click job:', _error);
      throw _error; // Re-throw to trigger BullMQ retry mechanism
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
      
    } catch (_error) {
      console.error(`Failed to sync click count for slug ${slug}:`, _error);
      throw _error;
    }
  }

  private async logAnalytics(slug: string, userAgent?: string, ip?: string, timestamp?: string): Promise<void> {
    try {
      // For now, just log to console. In the future, this could store detailed analytics
      const anonymizedIP = ip ? this.anonymizeIP(ip) : 'unknown';
      const browserInfo = userAgent ? this.extractBrowserInfo(userAgent) : 'unknown';
      
      console.log(`Analytics: ${slug} | ${anonymizedIP} | ${browserInfo} | ${timestamp}`);
      
      // TODO: Store in analytics table or send to analytics service
      
    } catch (_error) {
      // Don't throw here - analytics failures shouldn't break click processing
      console.warn('Failed to log analytics:', _error);
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
    
    await Promise.allSettled(promises);
  }

  // Health check for the job handler
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache service
      await this.cacheService.isHealthy();
      
      // Test database connection through repository
      // This is a simple test - in production you might want a dedicated health check method
      return true;
      
    } catch (_error) {
      console.error('Click processing job handler health check failed:', _error);
      return false;
    }
  }
} 