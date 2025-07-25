import { PrismaClient } from '@prisma/client';
import { UrlRepository as IUrlRepository, UrlEntity } from '../types';

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
          expiresAt: urlData.expiresAt || null,
          userId: urlData.userId || null,
        },
      });

      return this.mapPrismaToEntity(result);
    } catch (error: unknown) {
      console.error('Error creating URL:', error);
      throw new Error(`Failed to create URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async findBySlug(slug: string): Promise<UrlEntity | null> {
    try {
      const result = await this.prisma.url.findUnique({
        where: { shortSlug: slug },
      });

      return result ? this.mapPrismaToEntity(result) : null;
    } catch (error: unknown) {
      console.error('Error finding URL by slug:', error);
      throw new Error(`Failed to find URL by slug: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async findById(id: string): Promise<UrlEntity | null> {
    try {
      const result = await this.prisma.url.findUnique({
        where: { id },
      });

      return result ? this.mapPrismaToEntity(result) : null;
    } catch (error: unknown) {
      console.error('Error finding URL by ID:', error);
      throw new Error(`Failed to find URL by ID: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error finding URL by original URL:', error);
      throw new Error(`Failed to find URL by original URL: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`URL with slug '${slug}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error incrementing click count:', error);
      throw new Error(`Failed to increment click count: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`URL with slug '${slug}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error bulk incrementing click count:', error);
      throw new Error(`Failed to bulk increment click count: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error finding URLs by user ID:', error);
      throw new Error(`Failed to find URLs by user ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteBySlug(slug: string): Promise<void> {
    try {
      const result = await this.prisma.url.delete({
        where: { shortSlug: slug },
      });

      if (!result) {
        throw new Error(`URL with slug '${slug}' not found`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new Error(`URL with slug '${slug}' not found`);
      }
      console.error('Error deleting URL by slug:', error);
      throw new Error(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteById(id: string): Promise<void> {
    try {
      const result = await this.prisma.url.delete({
        where: { id },
      });

      if (!result) {
        throw new Error(`URL with id '${id}' not found`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new Error(`URL with id '${id}' not found`);
      }
      console.error('Error deleting URL by ID:', error);
      throw new Error(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTotalUrlCount(): Promise<number> {
    try {
      return await this.prisma.url.count();
    } catch (error: unknown) {
      console.error('Error getting total URL count:', error);
      throw new Error(`Failed to get total URL count: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting total click count:', error);
      throw new Error(`Failed to get total click count: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting popular URLs:', error);
      throw new Error(`Failed to get popular URLs: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting recent URLs:', error);
      throw new Error(`Failed to get recent URLs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createMany(urls: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<UrlEntity[]> {
    try {
      const data = urls.map(url => ({
        originalUrl: url.originalUrl,
        shortSlug: url.shortSlug,
        clickCount: url.clickCount,
        expiresAt: url.expiresAt || null,
        userId: url.userId || null,
      }));

      // Prisma doesn't return created records from createMany, so we need to use transactions
      const results = await this.prisma.$transaction(
        data.map(urlData => 
          this.prisma.url.create({ data: urlData })
        )
      );

      return results.map(result => this.mapPrismaToEntity(result));
    } catch (error: unknown) {
      console.error('Error creating multiple URLs:', error);
      throw new Error(`Failed to create multiple URLs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to map Prisma result to UrlEntity
  private mapPrismaToEntity(prismaUrl: {
    id: string;
    originalUrl: string;
    shortSlug: string;
    clickCount: number;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date | null; // Make optional since Prisma client might not have it yet
    userId: string | null;
  }): UrlEntity {
    return {
      id: prismaUrl.id,
      originalUrl: prismaUrl.originalUrl,
      shortSlug: prismaUrl.shortSlug,
      clickCount: prismaUrl.clickCount,
      createdAt: prismaUrl.createdAt,
      updatedAt: prismaUrl.updatedAt,
      expiresAt: prismaUrl.expiresAt || undefined,
      userId: prismaUrl.userId || undefined,
    };
  }

  // Cleanup method for graceful shutdown
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
} 