import { UrlService } from '../../../src/services/UrlService';
import { PrismaUrlRepository } from '../../../src/repositories/PrismaUrlRepository';
import { CacheService } from '../../../src/services/CacheService';
import { 
  InvalidUrlError,
  UrlEntity,
  CreateUrlDto,
  CreateUrlResponseDto,
  UrlStatsDto
} from '../../../src/types';
import { mockUrls } from '../../fixtures/urls';

// Mock the dependencies
jest.mock('../../../src/repositories/PrismaUrlRepository');
jest.mock('../../../src/services/CacheService');

describe('UrlService', () => {
  let urlService: UrlService;
  let mockRepository: jest.Mocked<PrismaUrlRepository>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock repository
    mockRepository = new PrismaUrlRepository() as jest.Mocked<PrismaUrlRepository>;
    
    // Mock the methods we need
    mockRepository.create = jest.fn();
    mockRepository.findBySlug = jest.fn();
    mockRepository.findById = jest.fn();
    mockRepository.findByOriginalUrl = jest.fn();
    mockRepository.incrementClickCount = jest.fn();
    mockRepository.findByUserId = jest.fn();
    mockRepository.deleteBySlug = jest.fn();
    mockRepository.getTotalUrlCount = jest.fn();
    mockRepository.getPopularUrls = jest.fn();
    mockRepository.getRecentUrls = jest.fn();
    
    // Create mock cache service
    const mockCacheService = new CacheService({} as any) as jest.Mocked<CacheService>;
    
    // Create service instance
    urlService = new UrlService(mockRepository, mockCacheService);
  });

  describe('shortenUrl', () => {
    const validRequest: CreateUrlDto = {
      originalUrl: 'https://example.com/long-path'
    };

    it('should create a short URL successfully', async () => {
      const mockUrl = mockUrls[0];
      
      mockRepository.findByOriginalUrl.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockUrl);

      const result = await urlService.shortenUrl(validRequest);

      expect(mockRepository.findByOriginalUrl).toHaveBeenCalledWith(validRequest.originalUrl);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result.originalUrl).toBe(validRequest.originalUrl);
      expect(result.shortSlug).toBeDefined();
    });

    it('should handle invalid URLs', async () => {
      const invalidRequest: CreateUrlDto = {
        originalUrl: 'not-a-valid-url'
      };

      await expect(urlService.shortenUrl(invalidRequest))
        .rejects.toThrow(InvalidUrlError);
    });
  });

  describe('redirectUrl', () => {
    it('should return redirect data for existing URL', async () => {
      const slug = 'test123';
      const mockUrl = mockUrls[0];
      
      mockRepository.findBySlug.mockResolvedValue(mockUrl);

      const result = await urlService.redirectUrl(slug);

      expect(mockRepository.findBySlug).toHaveBeenCalledWith(slug);
      expect(result).not.toBeNull();
      expect(result?.originalUrl).toBe(mockUrl.originalUrl);
    });

    it('should return null if URL does not exist', async () => {
      const slug = 'nonexistent';
      
      mockRepository.findBySlug.mockResolvedValue(null);

      const result = await urlService.redirectUrl(slug);

      expect(result).toBeNull();
    });
  });

  describe('getUrlStats', () => {
    it('should return URL statistics', async () => {
      const slug = 'test123';
      const mockUrl = mockUrls[0];
      
      mockRepository.findBySlug.mockResolvedValue(mockUrl);

      const result = await urlService.getUrlStats(slug);

      expect(mockRepository.findBySlug).toHaveBeenCalledWith(slug);
      expect(result).toHaveProperty('shortUrl');
      expect(result).toHaveProperty('isExpired');
      expect(result).toHaveProperty('daysSinceCreation');
    });

    it('should throw error if URL does not exist', async () => {
      const slug = 'nonexistent';
      
      mockRepository.findBySlug.mockResolvedValue(null);

      await expect(urlService.getUrlStats(slug))
        .rejects.toThrow('URL with slug');
    });
  });

  describe('Error handling', () => {
    it('should propagate repository errors', async () => {
      const slug = 'test123';
      mockRepository.findBySlug.mockRejectedValue(new Error('Database connection failed'));

      await expect(urlService.getUrlStats(slug))
        .rejects.toThrow('Database connection failed');
    });
  });
}); 