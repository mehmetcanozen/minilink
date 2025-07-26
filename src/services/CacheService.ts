import { UrlEntity } from '../types';
import { RedisCache } from '../config/redis';
import { logger } from '../middleware/logger';

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

  constructor(cache: RedisCache) {
    this.cache = cache;
  }

  // URL Caching Methods
  async cacheUrl(slug: string, url: UrlEntity): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      await this.cache.setJSON(cacheKey, url, CACHE_TTL.URL_CACHE);
      logger.debug('URL cached successfully', { slug, cacheKey });
    } catch (error) {
      logger.error('Failed to cache URL', error as Error, { slug });
      // Don't throw - caching failures shouldn't break the main flow
    }
  }

  async getCachedUrl(slug: string): Promise<UrlEntity | null> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      const result = await this.cache.getJSON<UrlEntity>(cacheKey);
      
      if (result) {
        logger.debug('URL cache hit', { slug });
      } else {
        logger.debug('URL cache miss', { slug });
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get cached URL', error as Error, { slug });
      return null;
    }
  }

  async invalidateUrlCache(slug: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      await this.cache.del(cacheKey);
      logger.debug('URL cache invalidated', { slug });
    } catch (error) {
      logger.error('Failed to invalidate URL cache', error as Error, { slug });
    }
  }

  // Click Count Management (Redis-based)
  async incrementClickCount(slug: string): Promise<number> {
    try {
      const clickKey = `${CACHE_KEYS.URL_CLICKS}${slug}`;
      const newCount = await this.cache.incr(clickKey);
      
      // Set expiration for click count key (for cleanup)
      await this.cache.expire(clickKey, CACHE_TTL.URL_CACHE);
      
      logger.debug('Click count incremented', { slug, newCount });
      return newCount;
    } catch (error) {
      logger.error('Failed to increment click count', error as Error, { slug });
      return 0;
    }
  }

  async getClickCount(slug: string): Promise<number> {
    try {
      const clickKey = `${CACHE_KEYS.URL_CLICKS}${slug}`;
      const value = await this.cache.get(clickKey);
      const count = value ? parseInt(value, 10) : 0;
      
      logger.debug('Click count retrieved', { slug, count });
      return count;
    } catch (error) {
      logger.error('Failed to get click count', error as Error, { slug });
      return 0;
    }
  }

  async resetClickCount(slug: string): Promise<void> {
    try {
      const clickKey = `${CACHE_KEYS.URL_CLICKS}${slug}`;
      await this.cache.del(clickKey);
      logger.debug('Click count reset', { slug });
    } catch (error) {
      logger.error('Failed to reset click count', error as Error, { slug });
    }
  }

  // Cache for URL lookups by original URL (to prevent duplicates)
  async cacheUrlByOriginal(originalUrl: string, url: UrlEntity): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_ORIGINAL}${this.hashUrl(originalUrl)}`;
      await this.cache.setJSON(cacheKey, url, CACHE_TTL.URL_CACHE);
      logger.debug('URL cached by original', { originalUrl: originalUrl.substring(0, 50) + '...' });
    } catch (error) {
      logger.error('Failed to cache URL by original', error as Error, { originalUrl: originalUrl.substring(0, 50) + '...' });
    }
  }

  async getCachedUrlByOriginal(originalUrl: string): Promise<UrlEntity | null> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_ORIGINAL}${this.hashUrl(originalUrl)}`;
      const result = await this.cache.getJSON<UrlEntity>(cacheKey);
      
      if (result) {
        logger.debug('Original URL cache hit', { originalUrl: originalUrl.substring(0, 50) + '...' });
      } else {
        logger.debug('Original URL cache miss', { originalUrl: originalUrl.substring(0, 50) + '...' });
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get cached URL by original', error as Error, { originalUrl: originalUrl.substring(0, 50) + '...' });
      return null;
    }
  }

  // Popular URLs caching
  async cachePopularUrls(urls: UrlEntity[]): Promise<void> {
    try {
      await this.cache.setJSON(CACHE_KEYS.POPULAR_URLS, urls, CACHE_TTL.POPULAR_URLS);
      logger.debug('Popular URLs cached', { count: urls.length });
    } catch (error) {
      logger.error('Failed to cache popular URLs', error as Error, { count: urls.length });
    }
  }

  async getCachedPopularUrls(): Promise<UrlEntity[] | null> {
    try {
      const result = await this.cache.getJSON<UrlEntity[]>(CACHE_KEYS.POPULAR_URLS);
      
      if (result) {
        logger.debug('Popular URLs cache hit', { count: result.length });
      } else {
        logger.debug('Popular URLs cache miss');
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get cached popular URLs', error as Error);
      return null;
    }
  }

  // Recent URLs caching
  async cacheRecentUrls(urls: UrlEntity[]): Promise<void> {
    try {
      await this.cache.setJSON(CACHE_KEYS.RECENT_URLS, urls, CACHE_TTL.RECENT_URLS);
      logger.debug('Recent URLs cached', { count: urls.length });
    } catch (error) {
      logger.error('Failed to cache recent URLs', error as Error, { count: urls.length });
    }
  }

  async getCachedRecentUrls(): Promise<UrlEntity[] | null> {
    try {
      const result = await this.cache.getJSON<UrlEntity[]>(CACHE_KEYS.RECENT_URLS);
      
      if (result) {
        logger.debug('Recent URLs cache hit', { count: result.length });
      } else {
        logger.debug('Recent URLs cache miss');
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get cached recent URLs', error as Error);
      return null;
    }
  }

  // System stats caching
  async cacheSystemStats(stats: Record<string, unknown>): Promise<void> {
    try {
      await this.cache.setJSON(CACHE_KEYS.SYSTEM_STATS, stats, CACHE_TTL.SYSTEM_STATS);
      logger.debug('System stats cached', { statsKeys: Object.keys(stats) });
    } catch (error) {
      logger.error('Failed to cache system stats', error as Error);
    }
  }

  async getCachedSystemStats(): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.cache.getJSON<Record<string, unknown>>(CACHE_KEYS.SYSTEM_STATS);
      
      if (result) {
        logger.debug('System stats cache hit');
      } else {
        logger.debug('System stats cache miss');
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get cached system stats', error as Error);
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
      
      logger.debug('URL related cache invalidated', { slug, originalUrl: originalUrl ? 'provided' : 'not provided' });
    } catch (error) {
      logger.error('Failed to invalidate cache', error as Error, { slug });
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
      logger.info('Cache warmed successfully', { urlCount: urls.length });
    } catch (error) {
      logger.error('Failed to warm cache', error as Error, { urlCount: urls.length });
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
      logger.error('Failed to get cached data', error as Error, { key });
      return null;
    }
  }

  async setCachedData(key: string, value: string, ttl?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
      logger.debug('Cached data set', { key, ttl });
    } catch (error) {
      logger.error('Failed to set cached data', error as Error, { key });
      // Don't throw - caching failures shouldn't break the main flow
    }
  }

  // Enhanced cache monitoring and statistics
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic cache operations
      const testKey = 'health_check';
      await this.cache.set(testKey, 'test', 10);
      const result = await this.cache.get(testKey);
      await this.cache.del(testKey);
      
      const healthy = result === 'test';
      logger.debug('Cache health check completed', { healthy });
      return healthy;
    } catch (error) {
      logger.error('Cache health check failed', error as Error);
      return false;
    }
  }

  async getCacheStats(): Promise<{
    healthy: boolean;
    timestamp: string;
    error?: string;
  }> {
    try {
      const healthy = await this.isHealthy();
      
      logger.debug('Cache stats retrieved', { healthy });
      
      return {
        healthy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error as Error);
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Method to delete URL from cache (more specific than generic delCachedData)
  async deleteUrlFromCache(slug: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_SLUG}${slug}`;
      await this.cache.del(cacheKey);
      logger.debug('URL deleted from cache', { slug });
    } catch (error) {
      logger.error('Failed to delete URL from cache', error as Error, { slug });
    }
  }

  // Method to delete URL by original URL from cache
  async deleteUrlByOriginalFromCache(originalUrl: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEYS.URL_BY_ORIGINAL}${this.hashUrl(originalUrl)}`;
      await this.cache.del(cacheKey);
      logger.debug('URL by original deleted from cache', { originalUrl: originalUrl.substring(0, 50) + '...' });
    } catch (error) {
      logger.error('Failed to delete URL by original from cache', error as Error, { originalUrl: originalUrl.substring(0, 50) + '...' });
    }
  }
} 