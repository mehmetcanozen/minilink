import { CacheService } from '../../../src/services/CacheService';
import { RedisCache } from '../../../src/config/redis';
import { UrlEntity } from '../../../src/types';
import { mockUrls } from '../../fixtures/urls';

// Mock RedisCache
jest.mock('../../../src/config/redis');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisCache: jest.Mocked<RedisCache>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Redis cache
    mockRedisCache = {
      setJSON: jest.fn(),
      getJSON: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      isHealthy: jest.fn()
    } as any;

    // Create service instance
    cacheService = new CacheService(mockRedisCache);
  });

  describe('cacheUrl', () => {
    it('should cache URL successfully', async () => {
      const url = mockUrls[0];
      const slug = url.shortSlug;

      await cacheService.cacheUrl(slug, url);

      expect(mockRedisCache.setJSON).toHaveBeenCalledWith(
        `url:slug:${slug}`,
        url,
        300 // URL_CACHE TTL
      );
    });

    it('should handle cache errors gracefully', async () => {
      const url = mockUrls[0];
      const slug = url.shortSlug;

      mockRedisCache.setJSON.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.cacheUrl(slug, url)).resolves.toBeUndefined();
    });
  });

  describe('getCachedUrl', () => {
    it('should retrieve cached URL successfully', async () => {
      const url = mockUrls[0];
      const slug = url.shortSlug;

      mockRedisCache.getJSON.mockResolvedValue(url);

      const result = await cacheService.getCachedUrl(slug);

      expect(mockRedisCache.getJSON).toHaveBeenCalledWith(`url:slug:${slug}`);
      expect(result).toEqual(url);
    });

    it('should return null when URL not in cache', async () => {
      const slug = 'nonexistent';

      mockRedisCache.getJSON.mockResolvedValue(null);

      const result = await cacheService.getCachedUrl(slug);

      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      const slug = 'test';

      mockRedisCache.getJSON.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getCachedUrl(slug);

      expect(result).toBeNull();
    });
  });

  describe('invalidateUrlCache', () => {
    it('should invalidate URL cache successfully', async () => {
      const slug = 'test';

      await cacheService.invalidateUrlCache(slug);

      expect(mockRedisCache.del).toHaveBeenCalledWith(`url:slug:${slug}`);
    });

    it('should handle cache errors gracefully', async () => {
      const slug = 'test';

      mockRedisCache.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.invalidateUrlCache(slug)).resolves.toBeUndefined();
    });
  });

  describe('incrementClickCount', () => {
    it('should increment click count successfully', async () => {
      const slug = 'test';
      const expectedCount = 5;

      mockRedisCache.incr.mockResolvedValue(expectedCount);
      mockRedisCache.expire.mockResolvedValue(true);

      const result = await cacheService.incrementClickCount(slug);

      expect(mockRedisCache.incr).toHaveBeenCalledWith(`clicks:${slug}`);
      expect(mockRedisCache.expire).toHaveBeenCalledWith(`clicks:${slug}`, 300);
      expect(result).toBe(expectedCount);
    });

    it('should handle increment errors gracefully', async () => {
      const slug = 'test';

      mockRedisCache.incr.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.incrementClickCount(slug);

      expect(result).toBe(0);
    });
  });

  describe('getClickCount', () => {
    it('should get click count successfully', async () => {
      const slug = 'test';
      const expectedCount = 42;

      mockRedisCache.get.mockResolvedValue(expectedCount.toString());

      const result = await cacheService.getClickCount(slug);

      expect(mockRedisCache.get).toHaveBeenCalledWith(`clicks:${slug}`);
      expect(result).toBe(expectedCount);
    });

    it('should return 0 when no click count exists', async () => {
      const slug = 'test';

      mockRedisCache.get.mockResolvedValue(null);

      const result = await cacheService.getClickCount(slug);

      expect(result).toBe(0);
    });

    it('should handle cache errors gracefully', async () => {
      const slug = 'test';

      mockRedisCache.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getClickCount(slug);

      expect(result).toBe(0);
    });
  });

  describe('resetClickCount', () => {
    it('should reset click count successfully', async () => {
      const slug = 'test';

      await cacheService.resetClickCount(slug);

      expect(mockRedisCache.del).toHaveBeenCalledWith(`clicks:${slug}`);
    });

    it('should handle reset errors gracefully', async () => {
      const slug = 'test';

      mockRedisCache.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.resetClickCount(slug)).resolves.toBeUndefined();
    });
  });

  describe('cacheUrlByOriginal', () => {
    it('should cache URL by original URL successfully', async () => {
      const url = mockUrls[0];
      const originalUrl = url.originalUrl;

      await cacheService.cacheUrlByOriginal(originalUrl, url);

      expect(mockRedisCache.setJSON).toHaveBeenCalledWith(
        expect.stringMatching(/^url:original:/),
        url,
        300
      );
    });

    it('should handle cache errors gracefully', async () => {
      const url = mockUrls[0];
      const originalUrl = url.originalUrl;

      mockRedisCache.setJSON.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.cacheUrlByOriginal(originalUrl, url)).resolves.toBeUndefined();
    });
  });

  describe('getCachedUrlByOriginal', () => {
    it('should retrieve cached URL by original URL successfully', async () => {
      const url = mockUrls[0];
      const originalUrl = url.originalUrl;

      mockRedisCache.getJSON.mockResolvedValue(url);

      const result = await cacheService.getCachedUrlByOriginal(originalUrl);

      expect(mockRedisCache.getJSON).toHaveBeenCalledWith(
        expect.stringMatching(/^url:original:/)
      );
      expect(result).toEqual(url);
    });

    it('should return null when URL not in cache', async () => {
      const originalUrl = 'https://example.com/nonexistent';

      mockRedisCache.getJSON.mockResolvedValue(null);

      const result = await cacheService.getCachedUrlByOriginal(originalUrl);

      expect(result).toBeNull();
    });
  });

  describe('cachePopularUrls', () => {
    it('should cache popular URLs successfully', async () => {
      const urls = mockUrls.slice(0, 5);

      await cacheService.cachePopularUrls(urls);

      expect(mockRedisCache.setJSON).toHaveBeenCalledWith(
        'popular:urls',
        urls,
        60 // POPULAR_URLS TTL
      );
    });
  });

  describe('getCachedPopularUrls', () => {
    it('should retrieve cached popular URLs successfully', async () => {
      const urls = mockUrls.slice(0, 5);

      mockRedisCache.getJSON.mockResolvedValue(urls);

      const result = await cacheService.getCachedPopularUrls();

      expect(mockRedisCache.getJSON).toHaveBeenCalledWith('popular:urls');
      expect(result).toEqual(urls);
    });

    it('should return null when not in cache', async () => {
      mockRedisCache.getJSON.mockResolvedValue(null);

      const result = await cacheService.getCachedPopularUrls();

      expect(result).toBeNull();
    });
  });

  describe('cacheRecentUrls', () => {
    it('should cache recent URLs successfully', async () => {
      const urls = mockUrls.slice(0, 3);

      await cacheService.cacheRecentUrls(urls);

      expect(mockRedisCache.setJSON).toHaveBeenCalledWith(
        'recent:urls',
        urls,
        30 // RECENT_URLS TTL
      );
    });
  });

  describe('getCachedRecentUrls', () => {
    it('should retrieve cached recent URLs successfully', async () => {
      const urls = mockUrls.slice(0, 3);

      mockRedisCache.getJSON.mockResolvedValue(urls);

      const result = await cacheService.getCachedRecentUrls();

      expect(mockRedisCache.getJSON).toHaveBeenCalledWith('recent:urls');
      expect(result).toEqual(urls);
    });
  });

  describe('cacheSystemStats', () => {
    it('should cache system stats successfully', async () => {
      const stats = {
        totalUrls: 100,
        totalClicks: 500,
        averageClicksPerUrl: 5
      };

      await cacheService.cacheSystemStats(stats);

      expect(mockRedisCache.setJSON).toHaveBeenCalledWith(
        'stats:system',
        stats,
        60 // SYSTEM_STATS TTL
      );
    });
  });

  describe('getCachedSystemStats', () => {
    it('should retrieve cached system stats successfully', async () => {
      const stats = {
        totalUrls: 100,
        totalClicks: 500,
        averageClicksPerUrl: 5
      };

      mockRedisCache.getJSON.mockResolvedValue(stats);

      const result = await cacheService.getCachedSystemStats();

      expect(mockRedisCache.getJSON).toHaveBeenCalledWith('stats:system');
      expect(result).toEqual(stats);
    });
  });

  describe('invalidateUrlRelatedCache', () => {
    it('should invalidate all URL-related caches', async () => {
      const slug = 'test';
      const originalUrl = 'https://example.com/test';

      await cacheService.invalidateUrlRelatedCache(slug, originalUrl);

      expect(mockRedisCache.del).toHaveBeenCalledWith(`url:slug:${slug}`);
      expect(mockRedisCache.del).toHaveBeenCalledWith(`clicks:${slug}`);
      expect(mockRedisCache.del).toHaveBeenCalledWith(
        expect.stringMatching(/^url:original:/)
      );
      expect(mockRedisCache.del).toHaveBeenCalledWith('popular:urls');
      expect(mockRedisCache.del).toHaveBeenCalledWith('recent:urls');
      expect(mockRedisCache.del).toHaveBeenCalledWith('stats:system');
    });

    it('should invalidate caches without original URL', async () => {
      const slug = 'test';

      await cacheService.invalidateUrlRelatedCache(slug);

      expect(mockRedisCache.del).toHaveBeenCalledWith(`url:slug:${slug}`);
      expect(mockRedisCache.del).toHaveBeenCalledWith(`clicks:${slug}`);
      expect(mockRedisCache.del).toHaveBeenCalledWith('popular:urls');
      expect(mockRedisCache.del).toHaveBeenCalledWith('recent:urls');
      expect(mockRedisCache.del).toHaveBeenCalledWith('stats:system');
    });
  });

  describe('warmCache', () => {
    it('should warm cache with multiple URLs', async () => {
      const urls = mockUrls.slice(0, 3);

      await cacheService.warmCache(urls);

      // Should call cacheUrl and cacheUrlByOriginal for each URL
      expect(mockRedisCache.setJSON).toHaveBeenCalledTimes(urls.length * 2);
    });
  });

  describe('isHealthy', () => {
    it('should return true when cache is healthy', async () => {
      mockRedisCache.set.mockResolvedValue(undefined);
      mockRedisCache.get.mockResolvedValue('test');
      mockRedisCache.del.mockResolvedValue(1);

      const result = await cacheService.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when cache operations fail', async () => {
      mockRedisCache.set.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache stats successfully', async () => {
      mockRedisCache.set.mockResolvedValue(undefined);
      mockRedisCache.get.mockResolvedValue('test');
      mockRedisCache.del.mockResolvedValue(1);

      const result = await cacheService.getCacheStats();

      expect(result).toEqual({
        healthy: true,
        timestamp: expect.any(String)
      });
    });

    it('should return unhealthy stats when cache fails', async () => {
      mockRedisCache.set.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getCacheStats();

      expect(result).toEqual({
        healthy: false,
        error: 'Redis error',
        timestamp: expect.any(String)
      });
    });
  });

  describe('deleteUrlFromCache', () => {
    it('should delete URL from cache successfully', async () => {
      const slug = 'test';

      await cacheService.deleteUrlFromCache(slug);

      expect(mockRedisCache.del).toHaveBeenCalledWith(`url:slug:${slug}`);
    });
  });

  describe('deleteUrlByOriginalFromCache', () => {
    it('should delete URL by original from cache successfully', async () => {
      const originalUrl = 'https://example.com/test';

      await cacheService.deleteUrlByOriginalFromCache(originalUrl);

      expect(mockRedisCache.del).toHaveBeenCalledWith(
        expect.stringMatching(/^url:original:/)
      );
    });
  });
}); 