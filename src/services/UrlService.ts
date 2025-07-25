import { 
  UrlEntity, 
  CreateUrlDto, 
  CreateUrlResponseDto, 
  UrlRedirectDto, 
  UrlNotFoundError,
  InvalidUrlError,
  UrlService as IUrlService,
  UrlRepository as IUrlRepository
} from '../types';
import { Url } from '../models/Url';
import { generateUniqueSlug } from '../utils/slugGenerator';
import { config } from '../config';
import { CacheService } from './CacheService';
import { getQueueManager, QUEUE_NAMES, ClickProcessingJob } from '../queues/QueueManager';

export class UrlService implements IUrlService {
  private urlRepository: IUrlRepository;
  private cacheService: CacheService;

  constructor(urlRepository: IUrlRepository) {
    this.urlRepository = urlRepository;
    this.cacheService = new CacheService();
  }

  async shortenUrl(dto: CreateUrlDto): Promise<CreateUrlResponseDto> {
    try {
      // Validate the original URL
      Url.validateOriginalUrl(dto.originalUrl);

      // Normalize the URL
      const normalizedUrl = Url.normalizeUrl(dto.originalUrl);

      // Check cache first for existing URL
      const cachedUrl = await this.cacheService.getCachedUrlByOriginal(normalizedUrl);
      if (cachedUrl && this.shouldReuseUrl(cachedUrl, dto.userId)) {
        // Return cached result
        return {
          id: cachedUrl.id,
          originalUrl: cachedUrl.originalUrl,
          shortSlug: cachedUrl.shortSlug,
          shortUrl: cachedUrl.shortSlug ? 
            `${config.server.baseUrl}/${cachedUrl.shortSlug}` : 
            `${config.server.baseUrl}/error`,
          clickCount: cachedUrl.clickCount,
          createdAt: cachedUrl.createdAt,
          userId: cachedUrl.userId,
        };
      }

      // Check database for existing URL if not in cache
      const existingUrl = await this.urlRepository.findByOriginalUrl(normalizedUrl);
      if (existingUrl && this.shouldReuseUrl(existingUrl, dto.userId)) {
        // Cache the existing URL and return it
        await this.cacheService.cacheUrl(existingUrl.shortSlug, existingUrl);
        await this.cacheService.cacheUrlByOriginal(normalizedUrl, existingUrl);

        return {
          id: existingUrl.id,
          originalUrl: existingUrl.originalUrl,
          shortSlug: existingUrl.shortSlug,
          shortUrl: existingUrl.shortSlug ? 
            `${config.server.baseUrl}/${existingUrl.shortSlug}` : 
            `${config.server.baseUrl}/error`,
          clickCount: existingUrl.clickCount,
          createdAt: existingUrl.createdAt,
          userId: existingUrl.userId,
        };
      }

      // Generate a unique short slug
      const shortSlug = await this.generateSlug();

      // Create new URL entity
      const urlData = Url.create(normalizedUrl, shortSlug, dto.userId, dto.expiresAt);
      const newUrl = await this.urlRepository.create(urlData);

      // Cache the new URL
      await this.cacheService.cacheUrl(newUrl.shortSlug, newUrl);
      await this.cacheService.cacheUrlByOriginal(normalizedUrl, newUrl);

      // Invalidate aggregate caches (popular, recent, stats)
      await this.invalidateAggregateCaches();

      return {
        id: newUrl.id,
        originalUrl: newUrl.originalUrl,
        shortSlug: newUrl.shortSlug,
        shortUrl: `${config.server.baseUrl}/${newUrl.shortSlug}`,
        clickCount: newUrl.clickCount,
        createdAt: newUrl.createdAt,
        userId: newUrl.userId,
      };

    } catch (error) {
      if (error instanceof InvalidUrlError) {
        throw error;
      }
      console.error('Error shortening URL:', error);
      throw new Error('Failed to shorten URL');
    }
  }

  async redirectUrl(slug: string, userAgent?: string, ip?: string): Promise<UrlRedirectDto> {
    try {
      // Check cache first
      let url = await this.cacheService.getCachedUrl(slug);

      if (!url) {
        // If not in cache, get from database
        url = await this.urlRepository.findBySlug(slug);
        
        if (!url) {
          throw new UrlNotFoundError(`URL with slug '${slug}' not found`);
        }

        // Cache the URL for future requests
        await this.cacheService.cacheUrl(slug, url);
      }

      // Check if URL has expired
      const isExpired = url.expiresAt ? new Date() > url.expiresAt : false;

      // Process click asynchronously using BullMQ (only if not expired)
      if (!isExpired) {
        await this.processClickAsync(slug, userAgent, ip);
      }

      // Get the current click count from Redis (includes pending clicks)
      const currentClickCount = await this.cacheService.getClickCount(slug);
      const totalClickCount = url.clickCount + currentClickCount;

      return {
        originalUrl: url.originalUrl,
        clickCount: totalClickCount, // Return the real-time click count
        isExpired,
      };

    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      console.error('Error redirecting URL:', error);
      throw new Error('Failed to redirect URL');
    }
  }

  async getUrlStats(slug: string): Promise<UrlEntity> {
    try {
      // Check cache first
      let url = await this.cacheService.getCachedUrl(slug);

      if (!url) {
        // If not in cache, get from database
        url = await this.urlRepository.findBySlug(slug);
        
        if (!url) {
          throw new UrlNotFoundError(`URL with slug '${slug}' not found`);
        }

        // Cache the URL
        await this.cacheService.cacheUrl(slug, url);
      }

      // Get real-time click count from Redis if available
      const redisClickCount = await this.cacheService.getClickCount(slug);
      const totalClickCount = url.clickCount + redisClickCount;
      
      // Return URL with updated click count
      return {
        ...url,
        clickCount: totalClickCount,
      };

    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      console.error('Error getting URL stats:', error);
      throw new Error('Failed to get URL statistics');
    }
  }

  async getUrlById(id: string): Promise<UrlEntity | null> {
    try {
      return await this.urlRepository.findById(id);
    } catch (error) {
      console.error('Error getting URL by ID:', error);
      throw new Error('Failed to get URL by ID');
    }
  }

  async deleteUrl(slug: string, userId?: string): Promise<void> {
    try {
      const url = await this.urlRepository.findBySlug(slug);
      
      if (!url) {
        throw new UrlNotFoundError(`URL with slug '${slug}' not found`);
      }

      // Check ownership if userId is provided
      if (userId && url.userId !== userId) {
        throw new Error('Unauthorized: You can only delete your own URLs');
      }

      // Delete from database
      await this.urlRepository.deleteBySlug(slug);

      // Invalidate all related caches
      await this.cacheService.invalidateUrlRelatedCache(slug, url.originalUrl);

      console.log(`URL with slug '${slug}' deleted successfully`);

    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      console.error('Error deleting URL:', error);
      throw new Error('Failed to delete URL');
    }
  }

  async getUserUrls(userId: string, limit: number = 50, offset: number = 0): Promise<UrlEntity[]> {
    try {
      return await this.urlRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      console.error('Error getting user URLs:', error);
      throw new Error('Failed to get user URLs');
    }
  }

  async getPopularUrls(limit: number = 10): Promise<UrlEntity[]> {
    try {
      // Get from cache first
      const cachedUrls = await this.cacheService.getCachedPopularUrls();
      if (cachedUrls) {
        return cachedUrls;
      }

      // Get from database
      const urls = await this.urlRepository.getPopularUrls(limit);

      // Update click counts with Redis data
      const updatedUrls = await Promise.all(
        urls.map(async (url) => {
          const redisClickCount = await this.cacheService.getClickCount(url.shortSlug);
          return {
            ...url,
            clickCount: url.clickCount + redisClickCount,
          };
        })
      );

      // Cache the results
      await this.cacheService.cachePopularUrls(updatedUrls);

      return updatedUrls;
    } catch (error) {
      console.error('Error getting popular URLs:', error);
      throw new Error('Failed to get popular URLs');
    }
  }

  async getRecentUrls(limit: number = 10): Promise<UrlEntity[]> {
    try {
      // Get from cache first
      const cachedUrls = await this.cacheService.getCachedRecentUrls();
      if (cachedUrls) {
        return cachedUrls;
      }

      // Get from database
      const urls = await this.urlRepository.getRecentUrls(limit);

      // Update click counts with Redis data
      const updatedUrls = await Promise.all(
        urls.map(async (url) => {
          const redisClickCount = await this.cacheService.getClickCount(url.shortSlug);
          return {
            ...url,
            clickCount: url.clickCount + redisClickCount,
          };
        })
      );

      // Cache the results
      await this.cacheService.cacheRecentUrls(updatedUrls);

      return updatedUrls;
    } catch (error) {
      console.error('Error getting recent URLs:', error);
      throw new Error('Failed to get recent URLs');
    }
  }

  async getSystemStats(): Promise<Record<string, unknown>> {
    try {
      // Check cache first
      const cachedStats = await this.cacheService.getCachedSystemStats();
      if (cachedStats) {
        return cachedStats;
      }

      // Calculate stats from database
      const [totalUrls, totalClicks] = await Promise.all([
        this.urlRepository.getTotalUrlCount(),
        this.urlRepository.getTotalClickCount(),
      ]);

      const stats = {
        totalUrls,
        totalClicks,
        averageClicksPerUrl: totalUrls > 0 ? Math.round(totalClicks / totalUrls) : 0,
        timestamp: new Date().toISOString(),
      };

      // Cache the stats
      await this.cacheService.cacheSystemStats(stats);

      return stats;
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw new Error('Failed to get system statistics');
    }
  }

  async createMultipleUrls(urls: CreateUrlDto[]): Promise<CreateUrlResponseDto[]> {
    try {
      const results: CreateUrlResponseDto[] = [];

      // Process each URL
      for (const urlDto of urls) {
        try {
          const result = await this.shortenUrl(urlDto);
          results.push(result);
        } catch (error) {
          // Continue processing other URLs even if one fails
          console.error(`Failed to create URL ${urlDto.originalUrl}:`, error);
          results.push({
            id: '',
            originalUrl: urlDto.originalUrl,
            shortSlug: '',
            shortUrl: '',
            clickCount: 0,
            createdAt: new Date(),
            userId: urlDto.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          } as CreateUrlResponseDto);
        }
      }

      return results;
    } catch (error) {
      console.error('Error creating multiple URLs:', error);
      throw new Error('Failed to create multiple URLs');
    }
  }

  // Private helper methods
  private async generateSlug(): Promise<string> {
    try {
      // First, try to get a slug from the Redis pool
      const { ShortCodePoolJobHandler } = await import('../queues/handlers/ShortCodePoolJobHandler');
      const poolHandler = new ShortCodePoolJobHandler();
      const poolSlug = await poolHandler.getSlugFromPool();
      
      if (poolSlug) {
        console.log(`Using slug from pool: ${poolSlug}`);
        return poolSlug;
      }
      
      // If pool is empty, fallback to generating a new slug
      console.log('Pool is empty, generating new slug...');
      const existingSlugChecker = async (slug: string): Promise<boolean> => {
        // Check cache first
        const cachedUrl = await this.cacheService.getCachedUrl(slug);
        if (cachedUrl) {
          return true; // Slug exists
        }

        // Check database
        const existingUrl = await this.urlRepository.findBySlug(slug);
        return !!existingUrl;
      };

      return generateUniqueSlug({ existingSlugChecker });
    } catch (error) {
      console.error('Error getting slug from pool, falling back to generation:', error);
      
      // Fallback to original generation method
      const existingSlugChecker = async (slug: string): Promise<boolean> => {
        // Check cache first
        const cachedUrl = await this.cacheService.getCachedUrl(slug);
        if (cachedUrl) {
          return true; // Slug exists
        }

        // Check database
        const existingUrl = await this.urlRepository.findBySlug(slug);
        return !!existingUrl;
      };

      return generateUniqueSlug({ existingSlugChecker });
    }
  }

  private shouldReuseUrl(existingUrl: UrlEntity, requestUserId?: string): boolean {
    // If the existing URL has no user (public), always reuse
    if (!existingUrl.userId) {
      return true;
    }

    // If the request has no user, don't reuse private URLs
    if (!requestUserId) {
      return false;
    }

    // Only reuse if the user owns the URL
    return existingUrl.userId === requestUserId;
  }

  private async processClickAsync(slug: string, userAgent?: string, ip?: string): Promise<void> {
    try {
      const queueManager = getQueueManager();
      
      const jobData: ClickProcessingJob = {
        slug,
        timestamp: new Date(),
        userAgent,
        ip,
      };

      await queueManager.addJob(
        QUEUE_NAMES.CLICK_PROCESSING,
        'process-click',
        jobData,
        { priority: 1 } // Higher priority for click processing
      );

    } catch (error) {
      console.error('Failed to queue click processing job:', error);
      // Fallback to synchronous click counting if queue fails
      await this.incrementClickCountFallback(slug);
    }
  }

  private async incrementClickCountFallback(slug: string): Promise<void> {
    try {
      // Increment in Redis first (fast)
      await this.cacheService.incrementClickCount(slug);
      
      // Then increment in database (slower but persistent)
      await this.urlRepository.incrementClickCount(slug);
      
      // Invalidate cached URL to force refresh
      await this.cacheService.invalidateUrlCache(slug);

    } catch (error) {
      console.error(`Failed to increment click count for slug ${slug}:`, error);
      // Don't throw here - click counting failures shouldn't break redirects
    }
  }

  private async invalidateAggregateCaches(): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.getCachedPopularUrls(),
        this.cacheService.getCachedRecentUrls(),
        this.cacheService.getCachedSystemStats(),
      ].map(promise => promise.catch(() => null))); // Ignore cache errors

    } catch (error) {
      console.error('Failed to invalidate aggregate caches:', error);
      // Don't throw - cache invalidation failures shouldn't break the main flow
    }
  }
} 