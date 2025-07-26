import { Request, Response } from 'express';
import { ViewController } from '../../../src/controllers/ViewController';
import { UrlService } from '../../../src/services/UrlService';
import { UrlEntity } from '../../../src/types';
import { mockUrls } from '../../fixtures/urls';

// Mock the UrlService
jest.mock('../../../src/services/UrlService');

describe('ViewController', () => {
  let viewController: ViewController;
  let mockUrlService: jest.Mocked<UrlService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock service
    mockUrlService = new UrlService({} as any, {} as any) as jest.Mocked<UrlService>;

    // Create controller instance
    viewController = new ViewController(mockUrlService).bindMethods();

    // Setup mock request and response
    mockRequest = {
      method: 'GET',
      url: '/',
      headers: {},
      query: {},
      get: jest.fn().mockReturnValue('test-user-agent')
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis()
    };
  });

  describe('renderHome', () => {
    it('should render home page with popular and recent URLs', async () => {
      const popularUrls = mockUrls.slice(0, 5);
      const recentUrls = mockUrls.slice(0, 3);

      mockUrlService.getPopularUrls.mockResolvedValue(popularUrls);
      mockUrlService.getRecentUrls.mockResolvedValue(recentUrls);

      await viewController.renderHome(mockRequest as Request, mockResponse as Response);

      expect(mockUrlService.getPopularUrls).toHaveBeenCalledWith(5);
      expect(mockUrlService.getRecentUrls).toHaveBeenCalledWith(3);
      expect(mockResponse.render).toHaveBeenCalledWith('index', {
        title: 'URL Shortener',
        popularUrls,
        recentUrls,
        error: null
      });
    });

    it('should handle service errors gracefully', async () => {
      mockUrlService.getPopularUrls.mockRejectedValue(new Error('Service error'));
      mockUrlService.getRecentUrls.mockResolvedValue([]);

      await viewController.renderHome(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('index', {
        title: 'URL Shortener',
        popularUrls: [],
        recentUrls: [],
        error: 'Failed to load popular URLs'
      });
    });

    it('should handle both service errors', async () => {
      mockUrlService.getPopularUrls.mockRejectedValue(new Error('Popular URLs error'));
      mockUrlService.getRecentUrls.mockRejectedValue(new Error('Recent URLs error'));

      await viewController.renderHome(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('index', {
        title: 'URL Shortener',
        popularUrls: [],
        recentUrls: [],
        error: 'Failed to load popular URLs'
      });
    });
  });

  describe('renderDashboard', () => {
    it('should render dashboard with system stats and user URLs', async () => {
      const systemStats = {
        totalUrls: 100,
        totalClicks: 500,
        averageClicksPerUrl: 5,
        activeUrls: 95,
        expiredUrls: 5,
        timestamp: new Date().toISOString()
      };

      const userUrls = mockUrls.slice(0, 10);

      mockUrlService.getSystemStats.mockResolvedValue(systemStats);
      mockUrlService.getRecentUrls.mockResolvedValue(userUrls);

      await viewController.renderDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockUrlService.getSystemStats).toHaveBeenCalled();
      expect(mockUrlService.getRecentUrls).toHaveBeenCalledWith(10);
      expect(mockResponse.render).toHaveBeenCalledWith('dashboard', {
        title: 'Dashboard',
        systemStats,
        recentUrls: userUrls,
        error: null
      });
    });

    it('should handle system stats error', async () => {
      mockUrlService.getSystemStats.mockRejectedValue(new Error('Stats error'));
      mockUrlService.getRecentUrls.mockResolvedValue([]);

      await viewController.renderDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('dashboard', {
        title: 'Dashboard',
        systemStats: null,
        recentUrls: [],
        error: 'Failed to load system statistics'
      });
    });

    it('should handle recent URLs error', async () => {
      const systemStats = {
        totalUrls: 100,
        totalClicks: 500,
        averageClicksPerUrl: 5,
        activeUrls: 95,
        expiredUrls: 5,
        timestamp: new Date().toISOString()
      };

      mockUrlService.getSystemStats.mockResolvedValue(systemStats);
      mockUrlService.getRecentUrls.mockRejectedValue(new Error('Recent URLs error'));

      await viewController.renderDashboard(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('dashboard', {
        title: 'Dashboard',
        systemStats,
        recentUrls: [],
        error: 'Failed to load recent URLs'
      });
    });
  });

  describe('renderUrlStats', () => {
    it('should render URL stats page successfully', async () => {
      const slug = 'abc123';
      const urlStats = {
        id: '123',
        originalUrl: 'https://example.com/long-url',
        shortSlug: 'abc123',
        shortUrl: 'http://localhost:3000/abc123',
        clickCount: 42,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        expiresAt: undefined,
        isExpired: false,
        daysSinceCreation: 5,
        userId: 'user123'
      };

      mockRequest.params = { slug };
      mockUrlService.getUrlStats.mockResolvedValue(urlStats);

      await viewController.renderUrlStats(mockRequest as Request, mockResponse as Response);

      expect(mockUrlService.getUrlStats).toHaveBeenCalledWith(slug);
      expect(mockResponse.render).toHaveBeenCalledWith('url-stats', {
        title: `Stats for ${slug}`,
        urlStats,
        error: null
      });
    });

    it('should handle URL not found error', async () => {
      const slug = 'nonexistent';
      mockRequest.params = { slug };
      mockUrlService.getUrlStats.mockRejectedValue(new Error('URL not found'));

      await viewController.renderUrlStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('url-stats', {
        title: `Stats for ${slug}`,
        urlStats: null,
        error: 'URL not found'
      });
    });

    it('should handle service errors', async () => {
      const slug = 'abc123';
      mockRequest.params = { slug };
      mockUrlService.getUrlStats.mockRejectedValue(new Error('Service error'));

      await viewController.renderUrlStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('url-stats', {
        title: `Stats for ${slug}`,
        urlStats: null,
        error: 'Service error'
      });
    });
  });

  describe('render404', () => {
    it('should render 404 page', async () => {
      await viewController.render404(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.render).toHaveBeenCalledWith('error', {
        title: 'Page Not Found',
        error: {
          status: 404,
          message: 'The page you are looking for does not exist.',
          details: 'Please check the URL and try again.'
        }
      });
    });

    it('should include request information in development', async () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await viewController.render404(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.render).toHaveBeenCalledWith('error', {
        title: 'Page Not Found',
        error: {
          status: 404,
          message: 'The page you are looking for does not exist.',
          details: 'Please check the URL and try again.'
        },
        debug: {
          path: '/',
          method: 'GET',
          userAgent: 'test-user-agent'
        }
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('bindMethods', () => {
    it('should bind all methods to the instance', () => {
      const boundController = viewController.bindMethods();

      expect(boundController).toBe(viewController);
      expect(typeof boundController.renderHome).toBe('function');
      expect(typeof boundController.renderDashboard).toBe('function');
      expect(typeof boundController.renderUrlStats).toBe('function');
      expect(typeof boundController.render404).toBe('function');
    });
  });
}); 