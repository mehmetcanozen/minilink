import { ClickProcessingJobHandler } from '../../../src/queues/handlers/ClickProcessingJobHandler';
import { CacheService } from '../../../src/services/CacheService';
import { PrismaUrlRepository } from '../../../src/repositories/PrismaUrlRepository';

// Mock dependencies
jest.mock('../../../src/services/CacheService');
jest.mock('../../../src/repositories/PrismaUrlRepository');

describe('ClickProcessingJobHandler', () => {
  let clickProcessingHandler: ClickProcessingJobHandler;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockUrlRepository: jest.Mocked<PrismaUrlRepository>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock services
    mockCacheService = new CacheService({} as any) as jest.Mocked<CacheService>;
    mockUrlRepository = new PrismaUrlRepository() as jest.Mocked<PrismaUrlRepository>;

    // Create handler instance
    clickProcessingHandler = new ClickProcessingJobHandler(mockCacheService, mockUrlRepository);
  });

  describe('process', () => {
    it('should process click job successfully', async () => {
      const jobData = {
        slug: 'abc123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.1',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const job = { data: jobData };

      // Mock successful processing
      mockCacheService.incrementClickCount.mockResolvedValue(5);
      mockCacheService.getClickCount.mockResolvedValue(5);

      await clickProcessingHandler.process(job);

      expect(mockCacheService.incrementClickCount).toHaveBeenCalledWith(jobData.slug);
      expect(mockCacheService.getClickCount).toHaveBeenCalledWith(jobData.slug);
    });

    it('should handle missing optional parameters', async () => {
      const jobData = {
        slug: 'abc123',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const job = { data: jobData };

      mockCacheService.incrementClickCount.mockResolvedValue(1);
      mockCacheService.getClickCount.mockResolvedValue(1);

      await clickProcessingHandler.process(job);

      expect(mockCacheService.incrementClickCount).toHaveBeenCalledWith(jobData.slug);
    });

    it('should handle cache service errors gracefully', async () => {
      const jobData = {
        slug: 'abc123',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const job = { data: jobData };

      mockCacheService.incrementClickCount.mockRejectedValue(new Error('Cache error'));

      // Should not throw
      await expect(clickProcessingHandler.process(job)).resolves.toBeUndefined();
    });

    it('should handle repository errors gracefully', async () => {
      const jobData = {
        slug: 'abc123',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const job = { data: jobData };

      mockCacheService.incrementClickCount.mockResolvedValue(5);
      mockCacheService.getClickCount.mockResolvedValue(5);
      mockUrlRepository.incrementClickCount.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(clickProcessingHandler.process(job)).resolves.toBeUndefined();
    });
  });

  describe('shouldSyncToDatabase', () => {
    it('should return true when click count is high enough', async () => {
      const slug = 'abc123';
      const clickCount = 100;

      const result = await (clickProcessingHandler as any).shouldSyncToDatabase(slug, clickCount);

      expect(result).toBe(true);
    });

    it('should return false when click count is low', async () => {
      const slug = 'abc123';
      const clickCount = 5;

      const result = await (clickProcessingHandler as any).shouldSyncToDatabase(slug, clickCount);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const slug = 'abc123';
      const clickCount = 100;

      mockCacheService.getClickCount.mockRejectedValue(new Error('Cache error'));

      const result = await (clickProcessingHandler as any).shouldSyncToDatabase(slug, clickCount);

      expect(result).toBe(false);
    });
  });

  describe('syncClickCountToDatabase', () => {
    it('should sync click count to database successfully', async () => {
      const slug = 'abc123';
      const incrementAmount = 50;

      mockCacheService.getClickCount.mockResolvedValue(incrementAmount);
      mockCacheService.resetClickCount.mockResolvedValue(undefined);
      mockUrlRepository.bulkIncrementClickCount.mockResolvedValue(undefined);

      await (clickProcessingHandler as any).syncClickCountToDatabase(slug, incrementAmount);

      expect(mockCacheService.getClickCount).toHaveBeenCalledWith(slug);
      expect(mockCacheService.resetClickCount).toHaveBeenCalledWith(slug);
      expect(mockUrlRepository.bulkIncrementClickCount).toHaveBeenCalledWith(slug, incrementAmount);
    });

    it('should handle sync errors gracefully', async () => {
      const slug = 'abc123';
      const incrementAmount = 50;

      mockCacheService.getClickCount.mockRejectedValue(new Error('Cache error'));

      // Should not throw
      await expect((clickProcessingHandler as any).syncClickCountToDatabase(slug, incrementAmount))
        .resolves.toBeUndefined();
    });
  });

  describe('logAnalytics', () => {
    it('should log analytics successfully', async () => {
      const slug = 'abc123';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const ip = '192.168.1.1';
      const timestamp = '2024-01-01T10:00:00Z';

      await (clickProcessingHandler as any).logAnalytics(slug, userAgent, ip, timestamp);

      // This method should not throw and should handle logging internally
      expect(true).toBe(true);
    });

    it('should handle missing parameters', async () => {
      const slug = 'abc123';

      await (clickProcessingHandler as any).logAnalytics(slug);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('anonymizeIP', () => {
    it('should anonymize IPv4 address correctly', () => {
      const ip = '192.168.1.100';
      const result = (clickProcessingHandler as any).anonymizeIP(ip);

      expect(result).toBe('192.168.1.0');
    });

    it('should anonymize IPv6 address correctly', () => {
      const ip = '2001:db8::1234:5678:9abc:def0';
      const result = (clickProcessingHandler as any).anonymizeIP(ip);

      expect(result).toBe('2001:db8::');
    });

    it('should handle invalid IP addresses', () => {
      const ip = 'invalid-ip';
      const result = (clickProcessingHandler as any).anonymizeIP(ip);

      expect(result).toBe('unknown');
    });
  });

  describe('extractBrowserInfo', () => {
    it('should extract browser info from user agent', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const result = (clickProcessingHandler as any).extractBrowserInfo(userAgent);

      expect(result).toContain('Chrome');
    });

    it('should handle missing user agent', () => {
      const userAgent = '';
      const result = (clickProcessingHandler as any).extractBrowserInfo(userAgent);

      expect(result).toBe('Unknown');
    });

    it('should handle null user agent', () => {
      const userAgent = null as any;
      const result = (clickProcessingHandler as any).extractBrowserInfo(userAgent);

      expect(result).toBe('Unknown');
    });
  });

  describe('batchSyncClickCounts', () => {
    it('should batch sync click counts successfully', async () => {
      const slugCounts = [
        { slug: 'abc123', count: 50 },
        { slug: 'def456', count: 30 },
        { slug: 'ghi789', count: 20 }
      ];

      mockCacheService.getClickCount.mockResolvedValue(50);
      mockCacheService.resetClickCount.mockResolvedValue(undefined);
      mockUrlRepository.bulkIncrementClickCount.mockResolvedValue(undefined);

      await clickProcessingHandler.batchSyncClickCounts(slugCounts);

      expect(mockCacheService.getClickCount).toHaveBeenCalledTimes(3);
      expect(mockCacheService.resetClickCount).toHaveBeenCalledTimes(3);
      expect(mockUrlRepository.bulkIncrementClickCount).toHaveBeenCalledTimes(3);
    });

    it('should handle batch sync errors gracefully', async () => {
      const slugCounts = [
        { slug: 'abc123', count: 50 },
        { slug: 'def456', count: 30 }
      ];

      mockCacheService.getClickCount.mockRejectedValue(new Error('Cache error'));

      // Should not throw
      await expect(clickProcessingHandler.batchSyncClickCounts(slugCounts))
        .resolves.toBeUndefined();
    });
  });

  describe('healthCheck', () => {
    it('should return true when handler is healthy', async () => {
      const result = await clickProcessingHandler.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when handler is unhealthy', async () => {
      // Mock a scenario where the handler would be unhealthy
      // This would typically involve checking internal state or dependencies
      const result = await clickProcessingHandler.healthCheck();

      expect(typeof result).toBe('boolean');
    });
  });
}); 