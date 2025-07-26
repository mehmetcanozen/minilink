import { PrismaClient } from '@prisma/client';
import { PrismaUrlRepository } from '../../../src/repositories/PrismaUrlRepository';
import { UrlEntity } from '../../../src/types';
import { mockUrls } from '../../fixtures/urls';

// Mock PrismaClient
jest.mock('@prisma/client');

describe('PrismaUrlRepository', () => {
  let prismaUrlRepository: PrismaUrlRepository;
  let mockPrismaClient: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Prisma client
    mockPrismaClient = {
      url: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn()
      },
      $queryRaw: jest.fn(),
      $disconnect: jest.fn()
    } as any;

    // Create repository instance
    prismaUrlRepository = new PrismaUrlRepository(mockPrismaClient);
  });

  describe('create', () => {
    it('should create a new URL successfully', async () => {
      const urlData = {
        originalUrl: 'https://example.com/long-url',
        shortSlug: 'abc123',
        clickCount: 0,
        userId: 'user123'
      };

      const mockCreatedUrl = {
        id: '123',
        originalUrl: urlData.originalUrl,
        shortSlug: urlData.shortSlug,
        clickCount: urlData.clickCount,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        userId: urlData.userId
      };

      mockPrismaClient.url.create.mockResolvedValue(mockCreatedUrl);

      const result = await prismaUrlRepository.create(urlData);

      expect(mockPrismaClient.url.create).toHaveBeenCalledWith({
        data: {
          originalUrl: urlData.originalUrl,
          shortSlug: urlData.shortSlug,
          clickCount: urlData.clickCount,
          userId: urlData.userId
        }
      });

      expect(result).toEqual({
        id: mockCreatedUrl.id,
        originalUrl: mockCreatedUrl.originalUrl,
        shortSlug: mockCreatedUrl.shortSlug,
        clickCount: mockCreatedUrl.clickCount,
        createdAt: mockCreatedUrl.createdAt,
        updatedAt: mockCreatedUrl.updatedAt,
        expiresAt: undefined,
        userId: mockCreatedUrl.userId
      });
    });

    it('should handle Prisma errors', async () => {
      const urlData = {
        originalUrl: 'https://example.com/long-url',
        shortSlug: 'abc123',
        clickCount: 0
      };

      const prismaError = {
        code: 'P2002',
        message: 'Unique constraint failed',
        meta: { target: ['shortSlug'] }
      };

      mockPrismaClient.url.create.mockRejectedValue(prismaError);

      await expect(prismaUrlRepository.create(urlData))
        .rejects.toThrow('Unique constraint failed');
    });
  });

  describe('findBySlug', () => {
    it('should find URL by slug successfully', async () => {
      const slug = 'abc123';
      const mockUrl = {
        id: '123',
        originalUrl: 'https://example.com/long-url',
        shortSlug: slug,
        clickCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        userId: 'user123'
      };

      mockPrismaClient.url.findUnique.mockResolvedValue(mockUrl);

      const result = await prismaUrlRepository.findBySlug(slug);

      expect(mockPrismaClient.url.findUnique).toHaveBeenCalledWith({
        where: { shortSlug: slug }
      });

      expect(result).toEqual({
        id: mockUrl.id,
        originalUrl: mockUrl.originalUrl,
        shortSlug: mockUrl.shortSlug,
        clickCount: mockUrl.clickCount,
        createdAt: mockUrl.createdAt,
        updatedAt: mockUrl.updatedAt,
        expiresAt: undefined,
        userId: mockUrl.userId
      });
    });

    it('should return null when URL not found', async () => {
      const slug = 'nonexistent';

      mockPrismaClient.url.findUnique.mockResolvedValue(null);

      const result = await prismaUrlRepository.findBySlug(slug);

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find URL by ID successfully', async () => {
      const id = '123';
      const mockUrl = {
        id,
        originalUrl: 'https://example.com/long-url',
        shortSlug: 'abc123',
        clickCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        userId: 'user123'
      };

      mockPrismaClient.url.findUnique.mockResolvedValue(mockUrl);

      const result = await prismaUrlRepository.findById(id);

      expect(mockPrismaClient.url.findUnique).toHaveBeenCalledWith({
        where: { id }
      });

      expect(result).toEqual({
        id: mockUrl.id,
        originalUrl: mockUrl.originalUrl,
        shortSlug: mockUrl.shortSlug,
        clickCount: mockUrl.clickCount,
        createdAt: mockUrl.createdAt,
        updatedAt: mockUrl.updatedAt,
        expiresAt: undefined,
        userId: mockUrl.userId
      });
    });
  });

  describe('findByOriginalUrl', () => {
    it('should find URL by original URL successfully', async () => {
      const originalUrl = 'https://example.com/long-url';
      const mockUrl = {
        id: '123',
        originalUrl,
        shortSlug: 'abc123',
        clickCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        userId: 'user123'
      };

      mockPrismaClient.url.findFirst.mockResolvedValue(mockUrl);

      const result = await prismaUrlRepository.findByOriginalUrl(originalUrl);

      expect(mockPrismaClient.url.findFirst).toHaveBeenCalledWith({
        where: { originalUrl }
      });

      expect(result).toEqual({
        id: mockUrl.id,
        originalUrl: mockUrl.originalUrl,
        shortSlug: mockUrl.shortSlug,
        clickCount: mockUrl.clickCount,
        createdAt: mockUrl.createdAt,
        updatedAt: mockUrl.updatedAt,
        expiresAt: undefined,
        userId: mockUrl.userId
      });
    });
  });

  describe('incrementClickCount', () => {
    it('should increment click count successfully', async () => {
      const slug = 'abc123';
      const mockUpdatedUrl = {
        id: '123',
        originalUrl: 'https://example.com/long-url',
        shortSlug: slug,
        clickCount: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        userId: 'user123'
      };

      mockPrismaClient.url.update.mockResolvedValue(mockUpdatedUrl);

      await prismaUrlRepository.incrementClickCount(slug);

      expect(mockPrismaClient.url.update).toHaveBeenCalledWith({
        where: { shortSlug: slug },
        data: {
          clickCount: {
            increment: 1
          }
        }
      });
    });

    it('should handle Prisma errors', async () => {
      const slug = 'nonexistent';

      mockPrismaClient.url.update.mockRejectedValue(new Error('URL not found'));

      await expect(prismaUrlRepository.incrementClickCount(slug))
        .rejects.toThrow('URL not found');
    });
  });

  describe('bulkIncrementClickCount', () => {
    it('should bulk increment click count successfully', async () => {
      const slug = 'abc123';
      const incrementAmount = 5;
      const mockUpdatedUrl = {
        id: '123',
        originalUrl: 'https://example.com/long-url',
        shortSlug: slug,
        clickCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        userId: 'user123'
      };

      mockPrismaClient.url.update.mockResolvedValue(mockUpdatedUrl);

      await prismaUrlRepository.bulkIncrementClickCount(slug, incrementAmount);

      expect(mockPrismaClient.url.update).toHaveBeenCalledWith({
        where: { shortSlug: slug },
        data: {
          clickCount: {
            increment: incrementAmount
          }
        }
      });
    });
  });

  describe('findByUserId', () => {
    it('should find URLs by user ID successfully', async () => {
      const userId = 'user123';
      const limit = 10;
      const offset = 0;

      const mockUrls = [
        {
          id: '123',
          originalUrl: 'https://example.com/url1',
          shortSlug: 'abc123',
          clickCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          userId
        },
        {
          id: '124',
          originalUrl: 'https://example.com/url2',
          shortSlug: 'def456',
          clickCount: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          userId
        }
      ];

      mockPrismaClient.url.findMany.mockResolvedValue(mockUrls);

      const result = await prismaUrlRepository.findByUserId(userId, limit, offset);

      expect(mockPrismaClient.url.findMany).toHaveBeenCalledWith({
        where: { userId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId);
    });
  });

  describe('deleteBySlug', () => {
    it('should delete URL by slug successfully', async () => {
      const slug = 'abc123';

      mockPrismaClient.url.delete.mockResolvedValue({} as any);

      await prismaUrlRepository.deleteBySlug(slug);

      expect(mockPrismaClient.url.delete).toHaveBeenCalledWith({
        where: { shortSlug: slug }
      });
    });

    it('should handle deletion of non-existent URL', async () => {
      const slug = 'nonexistent';

      mockPrismaClient.url.delete.mockRejectedValue(new Error('Record to delete does not exist'));

      await expect(prismaUrlRepository.deleteBySlug(slug))
        .rejects.toThrow('Record to delete does not exist');
    });
  });

  describe('deleteById', () => {
    it('should delete URL by ID successfully', async () => {
      const id = '123';

      mockPrismaClient.url.delete.mockResolvedValue({} as any);

      await prismaUrlRepository.deleteById(id);

      expect(mockPrismaClient.url.delete).toHaveBeenCalledWith({
        where: { id }
      });
    });
  });

  describe('getTotalUrlCount', () => {
    it('should get total URL count successfully', async () => {
      const expectedCount = 100;

      mockPrismaClient.url.count.mockResolvedValue(expectedCount);

      const result = await prismaUrlRepository.getTotalUrlCount();

      expect(mockPrismaClient.url.count).toHaveBeenCalledWith();
      expect(result).toBe(expectedCount);
    });
  });

  describe('getTotalClickCount', () => {
    it('should get total click count successfully', async () => {
      const expectedCount = 500;

      mockPrismaClient.url.aggregate.mockResolvedValue({
        _sum: { clickCount: expectedCount }
      });

      const result = await prismaUrlRepository.getTotalClickCount();

      expect(mockPrismaClient.url.aggregate).toHaveBeenCalledWith({
        _sum: { clickCount: true }
      });
      expect(result).toBe(expectedCount);
    });

    it('should return 0 when no URLs exist', async () => {
      mockPrismaClient.url.aggregate.mockResolvedValue({
        _sum: { clickCount: null }
      });

      const result = await prismaUrlRepository.getTotalClickCount();

      expect(result).toBe(0);
    });
  });

  describe('getPopularUrls', () => {
    it('should get popular URLs successfully', async () => {
      const limit = 5;
      const mockUrls = [
        {
          id: '123',
          originalUrl: 'https://example.com/popular1',
          shortSlug: 'pop1',
          clickCount: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          userId: 'user123'
        }
      ];

      mockPrismaClient.url.findMany.mockResolvedValue(mockUrls);

      const result = await prismaUrlRepository.getPopularUrls(limit);

      expect(mockPrismaClient.url.findMany).toHaveBeenCalledWith({
        take: limit,
        orderBy: { clickCount: 'desc' }
      });

      expect(result).toHaveLength(1);
      expect(result[0].clickCount).toBe(100);
    });
  });

  describe('getRecentUrls', () => {
    it('should get recent URLs successfully', async () => {
      const limit = 5;
      const mockUrls = [
        {
          id: '123',
          originalUrl: 'https://example.com/recent1',
          shortSlug: 'rec1',
          clickCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          userId: 'user123'
        }
      ];

      mockPrismaClient.url.findMany.mockResolvedValue(mockUrls);

      const result = await prismaUrlRepository.getRecentUrls(limit);

      expect(mockPrismaClient.url.findMany).toHaveBeenCalledWith({
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('getExpiredUrls', () => {
    it('should get expired URLs successfully', async () => {
      const limit = 10;
      const expiredDate = new Date('2024-01-01');
      const mockUrls = [
        {
          id: '123',
          originalUrl: 'https://example.com/expired1',
          shortSlug: 'exp1',
          clickCount: 5,
          createdAt: new Date('2023-12-01'),
          updatedAt: new Date('2023-12-01'),
          expiresAt: expiredDate,
          userId: 'user123'
        }
      ];

      mockPrismaClient.url.findMany.mockResolvedValue(mockUrls);

      const result = await prismaUrlRepository.getExpiredUrls(limit);

      expect(mockPrismaClient.url.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date)
          }
        },
        take: limit,
        orderBy: { expiresAt: 'asc' }
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('deleteExpiredUrls', () => {
    it('should delete expired URLs successfully', async () => {
      const expectedDeletedCount = 5;

      mockPrismaClient.url.deleteMany.mockResolvedValue({
        count: expectedDeletedCount
      });

      const result = await prismaUrlRepository.deleteExpiredUrls();

      expect(mockPrismaClient.url.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date)
          }
        }
      });

      expect(result).toBe(expectedDeletedCount);
    });
  });

  describe('createMany', () => {
    it('should create multiple URLs successfully', async () => {
      const urlsData = [
        {
          originalUrl: 'https://example.com/url1',
          shortSlug: 'abc123',
          clickCount: 0,
          userId: 'user123'
        },
        {
          originalUrl: 'https://example.com/url2',
          shortSlug: 'def456',
          clickCount: 0,
          userId: 'user123'
        }
      ];

      const mockCreatedUrls = urlsData.map((data, index) => ({
        id: `id${index + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null
      }));

      mockPrismaClient.url.createMany.mockResolvedValue({
        count: mockCreatedUrls.length
      });

      mockPrismaClient.url.findMany.mockResolvedValue(mockCreatedUrls);

      const result = await prismaUrlRepository.createMany(urlsData);

      expect(mockPrismaClient.url.createMany).toHaveBeenCalledWith({
        data: urlsData
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Prisma successfully', async () => {
      await prismaUrlRepository.disconnect();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });
  });
}); 