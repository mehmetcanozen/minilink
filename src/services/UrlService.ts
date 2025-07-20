import { UrlService as IUrlService, CreateUrlDto, CreateUrlResponseDto, UrlRedirectDto, UrlEntity, UrlNotFoundError, InvalidUrlError } from '../types';
import { UrlRepository } from '../repositories/UrlRepository';
import { Url } from '../models/Url';
import { generateUniqueSlug, createSlugChecker } from '../utils/slugGenerator';
import { serverConfig } from '../config';

export class UrlService implements IUrlService {
  private urlRepository: UrlRepository;
  private slugChecker: (slug: string) => Promise<boolean>;

  constructor(urlRepository: UrlRepository) {
    this.urlRepository = urlRepository;
    this.slugChecker = createSlugChecker(urlRepository);
  }

  async shortenUrl(dto: CreateUrlDto, userId?: string): Promise<CreateUrlResponseDto> {
    try {
      // Validate the input URL
      Url.validateOriginalUrl(dto.originalUrl);

      // Check if we already have this URL (optional deduplication)
      const existingUrl = await this.urlRepository.findByOriginalUrl(dto.originalUrl);
      if (existingUrl && this.shouldReuseExistingUrl(existingUrl, userId)) {
        console.log('Reusing existing URL:', existingUrl.shortSlug);
        return this.createUrlResponse(existingUrl);
      }

      // Generate a unique slug
      const shortSlug = await this.generateSlugWithRetry();

      // Create the URL entity data
      const urlData = Url.create(dto.originalUrl, shortSlug, userId);

      // Save to repository
      const savedUrl = await this.urlRepository.create(urlData);

      console.log('Created new short URL:', savedUrl.shortSlug, 'for:', savedUrl.originalUrl);

      return this.createUrlResponse(savedUrl);
    } catch (error) {
      console.error('Error shortening URL:', error);
      
      if (error instanceof InvalidUrlError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('already exists')) {
        // Retry with a different slug if collision occurs
        return this.shortenUrl(dto, userId);
      }
      
      throw new Error(`Failed to shorten URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async redirectUrl(slug: string): Promise<UrlRedirectDto | null> {
    try {
      if (!slug || typeof slug !== 'string') {
        throw new InvalidUrlError('Invalid slug provided');
      }

      // Find the URL by slug
      const url = await this.urlRepository.findBySlug(slug);
      
      if (!url) {
        console.log('URL not found for slug:', slug);
        return null;
      }

      // Increment click count asynchronously (don't wait for it)
      this.incrementClickCountAsync(slug);

      console.log('Redirecting slug:', slug, 'to:', url.originalUrl);

      return {
        originalUrl: url.originalUrl,
        clickCount: url.clickCount + 1, // Return the incremented count
      };
    } catch (error) {
      console.error('Error redirecting URL:', error);
      
      if (error instanceof InvalidUrlError) {
        throw error;
      }
      
      throw new Error(`Failed to redirect URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUrlStats(slug: string): Promise<UrlEntity | null> {
    try {
      if (!slug || typeof slug !== 'string') {
        throw new InvalidUrlError('Invalid slug provided');
      }

      const url = await this.urlRepository.findBySlug(slug);
      
      if (!url) {
        return null;
      }

      return url;
    } catch (error) {
      console.error('Error getting URL stats:', error);
      throw new Error(`Failed to get URL stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Additional service methods for extended functionality

  async getUrlById(id: string): Promise<UrlEntity | null> {
    try {
      return await this.urlRepository.findById(id);
    } catch (error) {
      console.error('Error getting URL by ID:', error);
      throw new Error(`Failed to get URL by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteUrl(slug: string, userId?: string): Promise<boolean> {
    try {
      // First check if the URL exists and user has permission
      const urlEntity = await this.urlRepository.findBySlug(slug);
      
      if (!urlEntity) {
        throw new UrlNotFoundError(slug);
      }

      // If userId is provided, check ownership
      if (userId) {
        const url = new Url(urlEntity);
        if (!url.isOwnedBy(userId)) {
          throw new Error('Unauthorized: You can only delete your own URLs');
        }
      }

      const deleted = await this.urlRepository.deleteBySlug(slug);
      
      if (deleted) {
        console.log('Deleted URL with slug:', slug);
      }
      
      return deleted;
    } catch (error) {
      console.error('Error deleting URL:', error);
      
      if (error instanceof UrlNotFoundError) {
        throw error;
      }
      
      throw new Error(`Failed to delete URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserUrls(userId: string, limit: number = 50, offset: number = 0): Promise<UrlEntity[]> {
    try {
      return await this.urlRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      console.error('Error getting user URLs:', error);
      throw new Error(`Failed to get user URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPopularUrls(limit: number = 10): Promise<UrlEntity[]> {
    try {
      return await this.urlRepository.getPopularUrls(limit);
    } catch (error) {
      console.error('Error getting popular URLs:', error);
      throw new Error(`Failed to get popular URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRecentUrls(limit: number = 10): Promise<UrlEntity[]> {
    try {
      return await this.urlRepository.getRecentUrls(limit);
    } catch (error) {
      console.error('Error getting recent URLs:', error);
      throw new Error(`Failed to get recent URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSystemStats(): Promise<{ totalUrls: number; totalClicks: number }> {
    try {
      const [totalUrls, totalClicks] = await Promise.all([
        this.urlRepository.getTotalUrlCount(),
        this.urlRepository.getTotalClickCount(),
      ]);

      return {
        totalUrls,
        totalClicks,
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw new Error(`Failed to get system stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async generateSlugWithRetry(maxRetries: number = 5): Promise<string> {
    return generateUniqueSlug({
      maxRetries,
      existingSlugChecker: this.slugChecker,
    });
  }

  private shouldReuseExistingUrl(existingUrl: UrlEntity, userId?: string): boolean {
    // Only reuse if:
    // 1. The URL was created by the same user (or both are anonymous)
    // 2. It's a recent URL (less than 24 hours old)
    
    const isSameUser = existingUrl.userId === userId;
    const isRecent = this.isUrlRecent(existingUrl.createdAt);
    
    return isSameUser && isRecent;
  }

  private isUrlRecent(createdAt: Date): boolean {
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24; // Consider URLs less than 24 hours old as recent
  }

  private createUrlResponse(url: UrlEntity): CreateUrlResponseDto {
    const urlModel = url instanceof Url ? url : new Url(url);
    
    return {
      id: url.id,
      originalUrl: url.originalUrl,
      shortUrl: urlModel.getShortUrl(serverConfig.baseUrl),
      shortSlug: url.shortSlug,
      clickCount: url.clickCount,
      createdAt: url.createdAt,
    };
  }

  private async incrementClickCountAsync(slug: string): Promise<void> {
    try {
      await this.urlRepository.incrementClickCount(slug);
    } catch (error) {
      // Log the error but don't throw it since this shouldn't fail the redirect
      console.error('Failed to increment click count for slug:', slug, error);
    }
  }

  // URL validation methods for API layer
  static validateCreateUrlDto(dto: any): CreateUrlDto {
    if (!dto || typeof dto !== 'object') {
      throw new InvalidUrlError('Request body must be a valid object');
    }

    if (!dto.originalUrl || typeof dto.originalUrl !== 'string') {
      throw new InvalidUrlError('originalUrl is required and must be a string');
    }

    // Trim whitespace
    const originalUrl = dto.originalUrl.trim();
    
    if (!originalUrl) {
      throw new InvalidUrlError('originalUrl cannot be empty');
    }

    return { originalUrl };
  }

  static validateSlug(slug: any): string {
    if (!slug || typeof slug !== 'string') {
      throw new InvalidUrlError('Slug must be a non-empty string');
    }

    const trimmedSlug = slug.trim();
    
    if (!trimmedSlug) {
      throw new InvalidUrlError('Slug cannot be empty');
    }

    if (trimmedSlug.length > 20) {
      throw new InvalidUrlError('Slug is too long');
    }

    return trimmedSlug;
  }

  // Batch operations for potential admin features
  async createMultipleUrls(urls: CreateUrlDto[], userId?: string): Promise<CreateUrlResponseDto[]> {
    try {
      const results: CreateUrlResponseDto[] = [];

      // Process URLs in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchPromises = batch.map(dto => this.shortenUrl(dto, userId));
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error('Failed to create URL in batch:', result.reason);
            // Optionally, you might want to collect and return errors
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error creating multiple URLs:', error);
      throw new Error(`Failed to create multiple URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 