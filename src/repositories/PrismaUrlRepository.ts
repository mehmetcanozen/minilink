import { PrismaClient } from '@prisma/client';
import { UrlRepository as IUrlRepository, UrlEntity } from '../types';
import { logger } from '../middleware/logger';

// Custom error types for better error handling
export class RepositoryError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class DuplicateResourceError extends Error {
  constructor(message: string, public readonly resource?: string) {
    super(message);
    this.name = 'DuplicateResourceError';
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message: string, public readonly resource?: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

export class PrismaUrlRepository implements IUrlRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async create(urlData: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity> {
    try {
      const result = await this.prisma.url.create({
        data: {
          originalUrl: urlData.originalUrl,
          shortSlug: urlData.shortSlug,
          clickCount: urlData.clickCount,
          isActive: urlData.isActive ?? true, // Default to true if not specified
          expiresAt: urlData.expiresAt || null,
          userId: urlData.userId || null,
        },
      });

      return this.mapPrismaToEntity(result);
    } catch (error: unknown) {
      logger.error('Error creating URL', error as Error, { shortSlug: urlData.shortSlug });
      
      // Handle Prisma-specific errors
      if (this.isPrismaError(error)) {
        if (error.code === 'P2002') {
          throw new DuplicateResourceError(`Short slug '${urlData.shortSlug}' already exists`, urlData.shortSlug);
        }
      }
      
      throw new RepositoryError(`Failed to create URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async reuseSlug(slug: string, newUrlData: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity> {
    try {
      // First, check if the slug exists (including inactive ones)
      const existingUrl = await this.findBySlugIncludingInactive(slug);
      if (!existingUrl) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }

      // Update the existing URL with new data and reactivate it
      const result = await this.prisma.url.update({
        where: { shortSlug: slug },
        data: {
          originalUrl: newUrlData.originalUrl,
          clickCount: 0, // Reset click count for reused slug
          isActive: true, // Reactivate the URL
          expiresAt: newUrlData.expiresAt || null,
          userId: newUrlData.userId || null,
          updatedAt: new Date(),
        },
      });

      logger.info('Slug reused successfully', { slug, newOriginalUrl: newUrlData.originalUrl });
      return this.mapPrismaToEntity(result);
    } catch (error: unknown) {
      logger.error('Error reusing slug', error as Error, { slug });
      throw new RepositoryError(`Failed to reuse slug: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async findBySlug(slug: string): Promise<UrlEntity | null> {
    try {
      const result = await this.prisma.url.findFirst({
        where: { 
          shortSlug: slug,
          isActive: true // Only return active URLs
        },
      });

      return result ? this.mapPrismaToEntity(result) : null;
    } catch (error: unknown) {
      logger.error('Error finding URL by slug', error as Error, { slug });
      throw new RepositoryError(`Failed to find URL by slug: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async findBySlugIncludingInactive(slug: string): Promise<UrlEntity | null> {
    try {
      const result = await this.prisma.url.findUnique({
        where: { shortSlug: slug },
      });

      return result ? this.mapPrismaToEntity(result) : null;
    } catch (error: unknown) {
      logger.error('Error finding URL by slug (including inactive)', error as Error, { slug });
      throw new RepositoryError(`Failed to find URL by slug: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async findById(id: string): Promise<UrlEntity | null> {
    try {
      const result = await this.prisma.url.findUnique({
        where: { id },
      });

      return result ? this.mapPrismaToEntity(result) : null;
    } catch (error: unknown) {
      logger.error('Error finding URL by ID', error as Error, { id });
      throw new RepositoryError(`Failed to find URL by ID: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async findByOriginalUrl(originalUrl: string): Promise<UrlEntity | null> {
    try {
      const result = await this.prisma.url.findFirst({
        where: { originalUrl },
        orderBy: { createdAt: 'desc' }, // Get the most recent one
      });

      return result ? this.mapPrismaToEntity(result) : null;
    } catch (error: unknown) {
      logger.error('Error finding URL by original URL', error as Error, { originalUrl });
      throw new RepositoryError(`Failed to find URL by original URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async incrementClickCount(slug: string): Promise<void> {
    try {
      const result = await this.prisma.url.update({
        where: { shortSlug: slug },
        data: {
          clickCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (!result) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
    } catch (error: unknown) {
      logger.error('Error incrementing click count', error as Error, { slug });
      
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      throw new RepositoryError(`Failed to increment click count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async bulkIncrementClickCount(slug: string, incrementAmount: number): Promise<void> {
    if (incrementAmount <= 0) return;

    try {
      const result = await this.prisma.url.update({
        where: { shortSlug: slug },
        data: {
          clickCount: { increment: incrementAmount },
          updatedAt: new Date(),
        },
      });

      if (!result) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
    } catch (error: unknown) {
      logger.error('Error bulk incrementing click count', error as Error, { slug, incrementAmount });
      
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      throw new RepositoryError(`Failed to bulk increment click count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<UrlEntity[]> {
    try {
      const results = await this.prisma.url.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return results.map(result => this.mapPrismaToEntity(result));
    } catch (error: unknown) {
      logger.error('Error finding URLs by user ID', error as Error, { userId, limit, offset });
      throw new RepositoryError(`Failed to find URLs by user ID: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async deleteBySlug(slug: string): Promise<void> {
    try {
      const result = await this.prisma.url.delete({
        where: { shortSlug: slug },
      });

      if (!result) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
      
      logger.error('Error deleting URL by slug', error as Error, { slug });
      throw new RepositoryError(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async deleteById(id: string): Promise<void> {
    try {
      const result = await this.prisma.url.delete({
        where: { id },
      });

      if (!result) {
        throw new ResourceNotFoundError(`URL with id '${id}' not found`, id);
      }
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new ResourceNotFoundError(`URL with id '${id}' not found`, id);
      }
      
      logger.error('Error deleting URL by ID', error as Error, { id });
      throw new RepositoryError(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async getTotalUrlCount(): Promise<number> {
    try {
      return await this.prisma.url.count();
    } catch (error: unknown) {
      logger.error('Error getting total URL count', error as Error);
      throw new RepositoryError(`Failed to get total URL count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async getTotalClickCount(): Promise<number> {
    try {
      const result = await this.prisma.url.aggregate({
        _sum: {
          clickCount: true,
        },
      });

      return result._sum.clickCount || 0;
    } catch (error: unknown) {
      logger.error('Error getting total click count', error as Error);
      throw new RepositoryError(`Failed to get total click count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async getPopularUrls(limit: number): Promise<UrlEntity[]> {
    try {
      const results = await this.prisma.url.findMany({
        orderBy: { clickCount: 'desc' },
        take: limit,
      });

      return results.map(result => this.mapPrismaToEntity(result));
    } catch (error: unknown) {
      logger.error('Error getting popular URLs', error as Error, { limit });
      throw new RepositoryError(`Failed to get popular URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async getRecentUrls(limit: number): Promise<UrlEntity[]> {
    try {
      const results = await this.prisma.url.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return results.map(result => this.mapPrismaToEntity(result));
    } catch (error: unknown) {
      logger.error('Error getting recent URLs', error as Error, { limit });
      throw new RepositoryError(`Failed to get recent URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async getExpiredUrls(limit: number = 100): Promise<UrlEntity[]> {
    try {
      const results = await this.prisma.url.findMany({
        where: {
          expiresAt: {
            not: null,
            lt: new Date(),
          },
          isActive: true, // Only get active URLs that have expired
        },
        orderBy: { expiresAt: 'asc' },
        take: limit,
      });

      return results.map(result => this.mapPrismaToEntity(result));
    } catch (error: unknown) {
      logger.error('Error getting expired URLs', error as Error, { limit });
      throw new RepositoryError(`Failed to get expired URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  async deleteExpiredUrls(): Promise<number> {
    try {
      const result = await this.prisma.url.updateMany({
        where: {
          expiresAt: {
            not: null,
            lt: new Date(),
          },
          isActive: true, // Only deactivate active URLs
        },
        data: {
          isActive: false, // Set to inactive instead of deleting
        },
      });

      logger.info('Deactivated expired URLs', { count: result.count });
      return result.count;
    } catch (error: unknown) {
      logger.error('Error deactivating expired URLs', error as Error);
      throw new RepositoryError(`Failed to deactivate expired URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  // CRITICAL PERFORMANCE IMPROVEMENT: Use Prisma's true bulk createMany
  async createMany(urls: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<UrlEntity[]> {
    if (urls.length === 0) {
      return [];
    }

    try {
      const data = urls.map(url => ({
        originalUrl: url.originalUrl,
        shortSlug: url.shortSlug,
        clickCount: url.clickCount,
        expiresAt: url.expiresAt || null,
        userId: url.userId || null,
      }));

      // Use Prisma's true bulk createMany for maximum performance
      // Note: createMany doesn't return created records, so we need to fetch them if needed
      await this.prisma.url.createMany({
        data,
        skipDuplicates: true, // Skip duplicates instead of failing
      });

      // If we need the created records, fetch them by their unique shortSlugs
      // This is still much faster than individual creates
      const shortSlugs = urls.map(url => url.shortSlug);
      const createdUrls = await this.prisma.url.findMany({
        where: {
          shortSlug: {
            in: shortSlugs,
          },
        },
      });

      logger.info('Bulk created URLs', { 
        requested: urls.length, 
        created: createdUrls.length,
        skipped: urls.length - createdUrls.length 
      });

      return createdUrls.map(result => this.mapPrismaToEntity(result));
    } catch (error: unknown) {
      logger.error('Error creating multiple URLs', error as Error, { count: urls.length });
      throw new RepositoryError(`Failed to create multiple URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    }
  }

  // Helper method to map Prisma result to UrlEntity
  private mapPrismaToEntity(prismaUrl: {
    id: string;
    originalUrl: string;
    shortSlug: string;
    clickCount: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date | null;
    userId: string | null;
  }): UrlEntity {
    return {
      id: prismaUrl.id,
      originalUrl: prismaUrl.originalUrl,
      shortSlug: prismaUrl.shortSlug,
      clickCount: prismaUrl.clickCount,
      isActive: prismaUrl.isActive,
      createdAt: prismaUrl.createdAt,
      updatedAt: prismaUrl.updatedAt,
      expiresAt: prismaUrl.expiresAt || undefined,
      userId: prismaUrl.userId || undefined,
    };
  }

  // Helper method to check if error is a Prisma error
  private isPrismaError(error: unknown): error is { code: string; message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      typeof (error as { code: string }).code === 'string'
    );
  }

  // Cleanup method for graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Prisma repository disconnected successfully');
    } catch (error: unknown) {
      logger.error('Error disconnecting Prisma repository', error as Error);
      throw new RepositoryError('Failed to disconnect Prisma repository', error as Error);
    }
  }
} 