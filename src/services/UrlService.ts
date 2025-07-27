import {
  UrlEntity,
  CreateUrlDto,
  CreateUrlResponseDto,
  UrlRedirectDto,
  UrlStatsDto,
  SystemStatsDto,
  BulkCreateUrlDto,
  BulkCreateUrlResponseDto,
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
import { logger } from '../middleware/logger';

export class UrlService implements IUrlService {
  private urlRepository: IUrlRepository;
  private cacheService: CacheService;

  constructor(urlRepository: IUrlRepository, cacheService: CacheService) {
    this.urlRepository = urlRepository;
    this.cacheService = cacheService;
  }

  // Utility method to ensure Date fields are properly converted from strings (when retrieved from cache)
  private ensureDateFields(url: UrlEntity): UrlEntity {
    return {
      ...url,
      createdAt: url.createdAt instanceof Date ? url.createdAt : new Date(url.createdAt),
      updatedAt: url.updatedAt instanceof Date ? url.updatedAt : new Date(url.updatedAt),
      expiresAt: url.expiresAt ? (url.expiresAt instanceof Date ? url.expiresAt : new Date(url.expiresAt)) : undefined,
    };
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
        logger.info('URL reused from cache', { originalUrl: dto.originalUrl.substring(0, 50) + '...', shortSlug: cachedUrl.shortSlug });
        
        // Ensure Date fields are properly converted from strings (when retrieved from cache)
        const urlWithProperDates = this.ensureDateFields(cachedUrl);
        
        // Return cached result
        return {
          id: urlWithProperDates.id,
          originalUrl: urlWithProperDates.originalUrl,
          shortSlug: urlWithProperDates.shortSlug,
          shortUrl: urlWithProperDates.shortSlug ? 
            `${config.server.baseUrl}/${urlWithProperDates.shortSlug}` : 
            `${config.server.baseUrl}/error`,
          clickCount: urlWithProperDates.clickCount,
          createdAt: urlWithProperDates.createdAt,
          userId: urlWithProperDates.userId,
        };
      }

      // Check database for existing URL if not in cache
      const existingUrl = await this.urlRepository.findByOriginalUrl(normalizedUrl);
      if (existingUrl && this.shouldReuseUrl(existingUrl, dto.userId)) {
        logger.info('URL reused from database', { originalUrl: dto.originalUrl.substring(0, 50) + '...', shortSlug: existingUrl.shortSlug });
        
        // Cache the existing URL and return it
        await this.cacheService.cacheUrl(existingUrl.shortSlug, existingUrl);
        await this.cacheService.cacheUrlByOriginal(normalizedUrl, existingUrl);

        // Ensure Date fields are properly converted from strings (when retrieved from cache)
        const urlWithProperDates = this.ensureDateFields(existingUrl);

        return {
          id: urlWithProperDates.id,
          originalUrl: urlWithProperDates.originalUrl,
          shortSlug: urlWithProperDates.shortSlug,
          shortUrl: urlWithProperDates.shortSlug ? 
            `${config.server.baseUrl}/${urlWithProperDates.shortSlug}` : 
            `${config.server.baseUrl}/error`,
          clickCount: urlWithProperDates.clickCount,
          createdAt: urlWithProperDates.createdAt,
          userId: urlWithProperDates.userId,
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

      logger.info('New URL created successfully', { 
        originalUrl: dto.originalUrl.substring(0, 50) + '...', 
        shortSlug: newUrl.shortSlug,
        userId: dto.userId || 'anonymous'
      });

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
      logger.error('Error shortening URL', error as Error, { 
        originalUrl: dto.originalUrl.substring(0, 50) + '...',
        userId: dto.userId || 'anonymous'
      });
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
        logger.debug('URL cached after database lookup', { slug });
      }

      // Ensure Date fields are properly converted from strings (when retrieved from cache)
      const urlWithProperDates = this.ensureDateFields(url);

      // Check if URL has expired
      const isExpired = urlWithProperDates.expiresAt ? new Date() > urlWithProperDates.expiresAt : false;

      // Process click asynchronously using BullMQ (only if not expired)
      if (!isExpired) {
        await this.processClickAsync(slug, userAgent, ip);
      }

      // Get the current click count from Redis (includes pending clicks)
      const currentClickCount = await this.cacheService.getClickCount(slug);
      const totalClickCount = url.clickCount + currentClickCount;

      logger.debug('URL redirect processed', { 
        slug, 
        isExpired, 
        totalClickCount,
        ip: ip || 'unknown'
      });

      return {
        originalUrl: urlWithProperDates.originalUrl,
        clickCount: totalClickCount, // Return the real-time click count
        isExpired,
      };

    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      logger.error('Error redirecting URL', error as Error, { slug, ip: ip || 'unknown' });
      throw new Error('Failed to redirect URL');
    }
  }

  async getUrlStats(slug: string): Promise<UrlStatsDto> {
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

      // Ensure Date fields are properly converted from strings (when retrieved from cache)
      const urlWithProperDates = this.ensureDateFields(url);

      // Get real-time click count from Redis if available
      const redisClickCount = await this.cacheService.getClickCount(slug);
      const totalClickCount = urlWithProperDates.clickCount + redisClickCount;
      
      // Calculate days since creation
      const daysSinceCreation = Math.floor((Date.now() - urlWithProperDates.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if URL is expired
      const isExpired = urlWithProperDates.expiresAt ? new Date() > urlWithProperDates.expiresAt : false;
      
      logger.debug('URL stats retrieved', { slug, totalClickCount });
      
      // Return UrlStatsDto with all required fields
      return {
        id: urlWithProperDates.id,
        originalUrl: urlWithProperDates.originalUrl,
        shortSlug: urlWithProperDates.shortSlug,
        shortUrl: `${config.server.baseUrl}/${urlWithProperDates.shortSlug}`,
        clickCount: totalClickCount,
        createdAt: urlWithProperDates.createdAt,
        updatedAt: urlWithProperDates.updatedAt,
        expiresAt: urlWithProperDates.expiresAt,
        isExpired,
        daysSinceCreation,
        userId: urlWithProperDates.userId,
      };

    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      logger.error('Error getting URL stats', error as Error, { slug });
      throw new Error('Failed to get URL statistics');
    }
  }

  async getUrlById(id: string): Promise<UrlEntity | null> {
    try {
      const url = await this.urlRepository.findById(id);
      logger.debug('URL retrieved by ID', { id, found: !!url });
      return url;
    } catch (error) {
      logger.error('Error getting URL by ID', error as Error, { id });
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
        logger.warn('Unauthorized URL deletion attempt', { slug, requestUserId: userId, urlUserId: url.userId });
        throw new Error('Unauthorized: You can only delete your own URLs');
      }

      // Delete from database
      await this.urlRepository.deleteBySlug(slug);

      // Invalidate all related caches
      await this.cacheService.invalidateUrlRelatedCache(slug, url.originalUrl);

      logger.info('URL deleted successfully', { slug, userId: userId || 'anonymous' });

    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      logger.error('Error deleting URL', error as Error, { slug, userId: userId || 'anonymous' });
      throw new Error('Failed to delete URL');
    }
  }

  async getUserUrls(userId: string, limit: number = 50, offset: number = 0): Promise<UrlEntity[]> {
    try {
      const urls = await this.urlRepository.findByUserId(userId, limit, offset);
      logger.debug('User URLs retrieved', { userId, count: urls.length, limit, offset });
      return urls;
    } catch (error) {
      logger.error('Error getting user URLs', error as Error, { userId, limit, offset });
      throw new Error('Failed to get user URLs');
    }
  }

  async getPopularUrls(limit: number = 10): Promise<UrlEntity[]> {
    try {
      // Get from cache first
      const cachedUrls = await this.cacheService.getCachedPopularUrls();
      if (cachedUrls) {
        logger.debug('Popular URLs retrieved from cache', { count: cachedUrls.length });
        // Ensure Date fields are properly converted from strings (when retrieved from cache)
        return cachedUrls.map(url => this.ensureDateFields(url));
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

      logger.debug('Popular URLs retrieved from database', { count: updatedUrls.length });
      return updatedUrls;
    } catch (error) {
      logger.error('Error getting popular URLs', error as Error, { limit });
      throw new Error('Failed to get popular URLs');
    }
  }

  async getRecentUrls(limit: number = 10): Promise<UrlEntity[]> {
    try {
      // Get from cache first
      const cachedUrls = await this.cacheService.getCachedRecentUrls();
      if (cachedUrls) {
        logger.debug('Recent URLs retrieved from cache', { count: cachedUrls.length });
        // Ensure Date fields are properly converted from strings (when retrieved from cache)
        return cachedUrls.map(url => this.ensureDateFields(url));
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

      logger.debug('Recent URLs retrieved from database', { count: updatedUrls.length });
      return updatedUrls;
    } catch (error) {
      logger.error('Error getting recent URLs', error as Error, { limit });
      throw new Error('Failed to get recent URLs');
    }
  }

  async getSystemStats(): Promise<SystemStatsDto> {
    try {
      // Check cache first
      const cachedStats = await this.cacheService.getCachedSystemStats();
      if (cachedStats) {
        logger.debug('System stats retrieved from cache');
        return cachedStats as unknown as SystemStatsDto;
      }

      // Calculate stats from database
      const [totalUrls, totalClicks] = await Promise.all([
        this.urlRepository.getTotalUrlCount(),
        this.urlRepository.getTotalClickCount(),
      ]);

      const stats: SystemStatsDto = {
        totalUrls,
        totalClicks,
        averageClicksPerUrl: totalUrls > 0 ? Math.round(totalClicks / totalUrls) : 0,
        activeUrls: totalUrls, // TODO: Implement active URLs calculation
        expiredUrls: 0, // TODO: Implement expired URLs calculation
        timestamp: new Date().toISOString(),
      };

      // Cache the stats
      await this.cacheService.cacheSystemStats(stats as unknown as Record<string, unknown>);

      logger.debug('System stats calculated from database', { totalUrls, totalClicks });
      return stats;
    } catch (error) {
      logger.error('Error getting system stats', error as Error);
      throw new Error('Failed to get system statistics');
    }
  }

  async createMultipleUrls(urls: CreateUrlDto[]): Promise<CreateUrlResponseDto[]> {
    try {
      const results: CreateUrlResponseDto[] = [];

      logger.info('Starting bulk URL creation', { count: urls.length });

      // Process each URL
      for (const urlDto of urls) {
        try {
          const result = await this.shortenUrl(urlDto);
          results.push(result);
        } catch (error) {
          // Continue processing other URLs even if one fails
          logger.error('Failed to create URL in batch', error as Error, { 
            originalUrl: urlDto.originalUrl.substring(0, 50) + '...' 
          });
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

      const successCount = results.filter(r => !r.error).length;
      const failureCount = results.length - successCount;
      
      logger.info('Bulk URL creation completed', { 
        total: urls.length, 
        success: successCount, 
        failures: failureCount 
      });

      return results;
    } catch (error) {
      logger.error('Error creating multiple URLs', error as Error, { count: urls.length });
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
        logger.debug('Using slug from pool', { slug: poolSlug });
        return poolSlug;
      }
      
      // If pool is empty, fallback to generating a new slug
      logger.debug('Pool is empty, generating new slug');
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
      logger.error('Error getting slug from pool, falling back to generation', error as Error);
      
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

      logger.debug('Click processing job queued', { slug, ip: ip || 'unknown' });

    } catch (error) {
      logger.error('Failed to queue click processing job', error as Error, { slug });
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

      logger.debug('Click count incremented via fallback', { slug });

    } catch (error) {
      logger.error('Failed to increment click count via fallback', error as Error, { slug });
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

      logger.debug('Aggregate caches invalidated');

    } catch (error) {
      logger.error('Failed to invalidate aggregate caches', error as Error);
      // Don't throw - cache invalidation failures shouldn't break the main flow
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createBulkUrls(dto: BulkCreateUrlDto): Promise<BulkCreateUrlResponseDto> {
    // TODO: Implement bulk URL creation with options
    throw new Error('Bulk URL creation not implemented yet');
  }

  async cleanupExpiredUrls(): Promise<number> {
    try {
      // TODO: Implement expired URL cleanup
      logger.info('Expired URL cleanup not implemented yet');
      return 0;
    } catch (error) {
      logger.error('Error cleaning up expired URLs', error as Error);
      throw new Error('Failed to cleanup expired URLs');
    }
  }
} 