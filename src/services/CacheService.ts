import { UrlEntity } from '../types';
import { RedisCache, createRedisCache } from '../config/redis';

// Cache key prefixes
const CACHE_KEYS = {
  URL_BY_SLUG: 'url:slug:',
  URL_CLICKS: 'clicks:',
  URL_BY_ORIGINAL: 'url:original:',
  POPULAR_URLS: 'popular:urls',
  RECENT_URLS: 'recent:urls',
  SYSTEM_STATS: 'stats:system',
} as const;

// Cache TTL values (in seconds)
const CACHE_TTL = {
  URL_CACHE: 300, // 5 minutes
  POPULAR_URLS: 60, // 1 minute
  RECENT_URLS: 30, // 30 seconds
  SYSTEM_STATS: 60, // 1 minute
} as const;

export class CacheService {
  private cache: RedisCache;

  constructor(cache?: RedisCache) {
    this.cache = cache || createRedisCache();
  }

  // URL Caching Methods
  async cacheUrl(slug: string, url: UrlEntity): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      await this.cache.setJSON(cacheKey, url, CACHE_TTL.URL_CACHE);
    } catch (error) {
      console.error(`Failed to cache URL for slug ${slug}:`, error);
      // Don't throw - caching failures shouldn't break the main flow
    }
  }

  async getCachedUrl(slug: string): Promise<UrlEntity | null> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      return await this.cache.getJSON<UrlEntity>(cacheKey);
    } catch (error) {
      console.error(`Failed to get cached URL for slug ${slug}:`, error);
      return null;
    }
  }

  async invalidateUrlCache(slug: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      await this.cache.del(cacheKey);
    } catch (error) {
      console.error(`Failed to invalidate URL cache for slug ${slug}:`, error);
    }
  }

  // Click Count Management (Redis-based)
  async incrementClickCount(slug: string): Promise<number> {
    try {
      const clickKey = `${CACHE_KEYS.URL_CLICKS}${slug}`;
      const newCount = await this.cache.incr(clickKey);
      
      // Set expiration for click count key (for cleanup)
      await this.cache.expire(clickKey, CACHE_TTL.URL_CACHE);
      
      return newCount;
    } catch (error) {
      console.error(`Failed to increment click count for slug ${slug}:`, error);
      return 0;
    }
  }

  async getClickCount(slug: string): Promise<number> {
    try {
      const clickKey = `${CACHE_KEYS.URL_CLICKS}${slug}`;
      const value = await this.cache.get(clickKey);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error(`Failed to get click count for slug ${slug}:`, error);
      return 0;
    }
  }

  async resetClickCount(slug: string): Promise<void> {
    try {
      const clickKey = `${CACHE_KEYS.URL_CLICKS}${slug}`;
      await this.cache.del(clickKey);
    } catch (error) {
      console.error(`Failed to reset click count for slug ${slug}:`, error);
    }
  }

  // Cache for URL lookups by original URL (to prevent duplicates)
  async cacheUrlByOriginal(originalUrl: string, url: UrlEntity): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_ORIGINAL}${this.hashUrl(originalUrl)}`;
      await this.cache.setJSON(cacheKey, url, CACHE_TTL.URL_CACHE);
    } catch (error) {
      console.error(`Failed to cache URL by original ${originalUrl}:`, error);
    }
  }

  async getCachedUrlByOriginal(originalUrl: string): Promise<UrlEntity | null> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_ORIGINAL}${this.hashUrl(originalUrl)}`;
      return await this.cache.getJSON<UrlEntity>(cacheKey);
    } catch (error) {
      console.error(`Failed to get cached URL by original ${originalUrl}:`, error);
      return null;
    }
  }

  // Popular URLs caching
  async cachePopularUrls(urls: UrlEntity[]): Promise<void> {
    try {
      await this.cache.setJSON(CACHE_KEYS.POPULAR_URLS, urls, CACHE_TTL.POPULAR_URLS);
    } catch (error) {
      console.error('Failed to cache popular URLs:', error);
    }
  }

  async getCachedPopularUrls(): Promise<UrlEntity[] | null> {
    try {
      return await this.cache.getJSON<UrlEntity[]>(CACHE_KEYS.POPULAR_URLS);
    } catch (error) {
      console.error('Failed to get cached popular URLs:', error);
      return null;
    }
  }

  // Recent URLs caching
  async cacheRecentUrls(urls: UrlEntity[]): Promise<void> {
    try {
      await this.cache.setJSON(CACHE_KEYS.RECENT_URLS, urls, CACHE_TTL.RECENT_URLS);
    } catch (error) {
      console.error('Failed to cache recent URLs:', error);
    }
  }

  async getCachedRecentUrls(): Promise<UrlEntity[] | null> {
    try {
      return await this.cache.getJSON<UrlEntity[]>(CACHE_KEYS.RECENT_URLS);
    } catch (error) {
      console.error('Failed to get cached recent URLs:', error);
      return null;
    }
  }

  // System stats caching
  async cacheSystemStats(stats: Record<string, unknown>): Promise<void> {
    try {
      await this.cache.setJSON(CACHE_KEYS.SYSTEM_STATS, stats, CACHE_TTL.SYSTEM_STATS);
    } catch (error) {
      console.error('Failed to cache system stats:', error);
    }
  }

  async getCachedSystemStats(): Promise<Record<string, unknown> | null> {
    try {
      return await this.cache.getJSON<Record<string, unknown>>(CACHE_KEYS.SYSTEM_STATS);
    } catch (error) {
      console.error('Failed to get cached system stats:', error);
      return null;
    }
  }

  // Batch cache invalidation
  async invalidateUrlRelatedCache(slug: string, originalUrl?: string): Promise<void> {
    try {
      // Invalidate URL cache
      await this.invalidateUrlCache(slug);
      
      // Reset click count
      await this.resetClickCount(slug);
      
      // Invalidate original URL cache if provided
      if (originalUrl) {
        const originalCacheKey = `${CACHE_KEYS.URL_BY_ORIGINAL}${this.hashUrl(originalUrl)}`;
        await this.cache.del(originalCacheKey);
      }
      
      // Invalidate aggregate caches
      await Promise.all([
        this.cache.del(CACHE_KEYS.POPULAR_URLS),
        this.cache.del(CACHE_KEYS.RECENT_URLS),
        this.cache.del(CACHE_KEYS.SYSTEM_STATS),
      ]);
    } catch (error) {
      console.error(`Failed to invalidate cache for slug ${slug}:`, error);
    }
  }

  // Cache warming (preload frequently accessed data)
  async warmCache(urls: UrlEntity[]): Promise<void> {
    try {
      const promises = urls.map(async (url) => {
        await this.cacheUrl(url.shortSlug, url);
        await this.cacheUrlByOriginal(url.originalUrl, url);
      });
      
      await Promise.all(promises);
      console.log(`Cache warmed with ${urls.length} URLs`);
    } catch (error) {
      console.error('Failed to warm cache:', error);
    }
  }

  // Utility methods
  private hashUrl(url: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    if (url.length === 0) return hash.toString();
    
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString();
  }

  // Generic cache methods
  async getCachedData(key: string): Promise<string | null> {
    try {
      return await this.cache.get(key);
    } catch (error) {
      console.error(`Failed to get cached data for key ${key}:`, error);
      return null;
    }
  }

  async setCachedData(key: string, value: string, ttl?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
    } catch (error) {
      console.error(`Failed to set cached data for key ${key}:`, error);
      // Don't throw - caching failures shouldn't break the main flow
    }
  }

  // Cache Statistics and Health Check
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic cache operations
      const testKey = 'health_check';
      await this.cache.set(testKey, 'test', 10);
      const result = await this.cache.get(testKey);
      await this.cache.del(testKey);
      return result === 'test';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  async getCacheStats(): Promise<{
    healthy: boolean;
    timestamp: string;
    error?: string;
  }> {
    try {
      // This would require Redis INFO command, but basic implementation
      return {
        healthy: await this.isHealthy(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
} 