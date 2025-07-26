import { Request, Response } from 'express';
import { UrlController } from '../../../src/controllers/UrlController';
import { UrlService } from '../../../src/services/UrlService';
import { CacheService } from '../../../src/services/CacheService';
import { CreateUrlDto, CreateUrlResponseDto, UrlStatsDto, SystemStatsDto } from '../../../src/types';
import { mockUrls } from '../../fixtures/urls';

// Mock the UrlService and CacheService
jest.mock('../../../src/services/UrlService');
jest.mock('../../../src/services/CacheService');

describe('UrlController', () => {
  let urlController: UrlController;
  let mockUrlService: jest.Mocked<UrlService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock services
    const mockRepository = {} as any;
    const mockCacheService = new CacheService({} as any) as jest.Mocked<CacheService>;
    mockUrlService = new UrlService(mockRepository, mockCacheService) as jest.Mocked<UrlService>;
    
    // Create controller instance
    urlController = new UrlController(mockUrlService).bindMethods();
    
    // Setup mock request and response
    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };
  });

  describe('createShortUrl', () => {
    it('should create a short URL successfully', async () => {
      const createUrlDto: CreateUrlDto = {
        originalUrl: 'https://example.com/long-url'
      };
      
      const mockResult: CreateUrlResponseDto = {
        id: '123',
        originalUrl: 'https://example.com/long-url',
        shortUrl: 'http://localhost:3000/abc123',
        shortSlug: 'abc123',
        clickCount: 0,
        createdAt: new Date()
      };

      mockRequest.body = createUrlDto;
      mockUrlService.shortenUrl.mockResolvedValue(mockResult);

      await urlController.createShortUrl(mockRequest as Request, mockResponse as Response);

      expect(mockUrlService.shortenUrl).toHaveBeenCalledWith(createUrlDto);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    it('should handle validation errors', async () => {
      const createUrlDto: CreateUrlDto = {
        originalUrl: 'invalid-url'
      };

      mockRequest.body = createUrlDto;
      mockUrlService.shortenUrl.mockRejectedValue(new Error('Invalid URL'));

      await urlController.createShortUrl(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Invalid URL'
        })
      });
    });

    it('should handle service errors', async () => {
      const createUrlDto: CreateUrlDto = {
        originalUrl: 'https://example.com/long-url'
      };

      mockRequest.body = createUrlDto;
      mockUrlService.shortenUrl.mockRejectedValue(new Error('Database error'));

      await urlController.createShortUrl(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Database error'
        })
      });
    });
  });

  describe('redirectToOriginalUrl', () => {
    it('should redirect to original URL successfully', async () => {
      const slug = 'abc123';
      const mockRedirectInfo = {
        originalUrl: 'https://example.com/long-url',
        shortSlug: 'abc123',
        clickCount: 1,
        isExpired: false
      };

      const requestWithIp = {
        ...mockRequest,
        params: { slug },
        get: jest.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' } as any
      };
      
      mockUrlService.redirectUrl.mockResolvedValue(mockRedirectInfo);

      await urlController.redirectToOriginalUrl(requestWithIp as Request, mockResponse as Response);

      expect(mockUrlService.redirectUrl).toHaveBeenCalledWith(slug, 'test-user-agent', '127.0.0.1');
      expect(mockResponse.redirect).toHaveBeenCalledWith(mockRedirectInfo.originalUrl);
    });

    it('should handle non-existent URLs', async () => {
      const slug = 'nonexistent';

      mockRequest.params = { slug };
      mockUrlService.redirectUrl.mockRejectedValue(new Error('URL not found'));

      await expect(urlController.redirectToOriginalUrl(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow('URL not found');
    });

    it('should handle expired URLs', async () => {
      const slug = 'expired';
      const expiredRedirectInfo = {
        originalUrl: 'https://example.com/expired',
        shortSlug: 'expired',
        clickCount: 0,
        isExpired: true
      };

      const requestWithIp = {
        ...mockRequest,
        params: { slug },
        get: jest.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' } as any
      };
      
      mockUrlService.redirectUrl.mockResolvedValue(expiredRedirectInfo);

      await urlController.redirectToOriginalUrl(requestWithIp as Request, mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(expiredRedirectInfo.originalUrl);
    });
  });

  describe('getUrlStats', () => {
    it('should return URL statistics successfully', async () => {
      const slug = 'abc123';
      const mockUrlStats = {
        id: mockUrls[0].id,
        originalUrl: mockUrls[0].originalUrl,
        shortSlug: mockUrls[0].shortSlug,
        shortUrl: `http://localhost:3000/${mockUrls[0].shortSlug}`,
        clickCount: mockUrls[0].clickCount,
        createdAt: mockUrls[0].createdAt,
        updatedAt: mockUrls[0].updatedAt,
        expiresAt: mockUrls[0].expiresAt,
        isExpired: false,
        daysSinceCreation: 5,
        userId: mockUrls[0].userId
      };

      mockRequest.params = { slug };
      mockUrlService.getUrlStats.mockResolvedValue(mockUrlStats);

      await urlController.getUrlStats(mockRequest as Request, mockResponse as Response);

      expect(mockUrlService.getUrlStats).toHaveBeenCalledWith(slug);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUrlStats
      });
    });

    it('should handle non-existent URLs for stats', async () => {
      const slug = 'nonexistent';

      mockRequest.params = { slug };
      mockUrlService.getUrlStats.mockRejectedValue(new Error('URL not found'));

      await expect(urlController.getUrlStats(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow('URL not found');
    });
  });

  describe('getSystemStats', () => {
    it('should return system statistics successfully', async () => {
      const mockStats = {
        totalUrls: 100,
        totalClicks: 500,
        averageClicksPerUrl: 5,
        activeUrls: 95,
        expiredUrls: 5,
        timestamp: new Date().toISOString()
      };

      mockUrlService.getSystemStats.mockResolvedValue(mockStats);

      await urlController.getSystemStats(mockRequest as Request, mockResponse as Response);

      expect(mockUrlService.getSystemStats).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should handle service errors for system stats', async () => {
      mockUrlService.getSystemStats.mockRejectedValue(new Error('Service error'));

      await urlController.getSystemStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Service error'
        })
      });
    });
  });
}); 