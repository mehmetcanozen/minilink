import { Pool } from 'pg';
import { UrlRepository } from '../../../src/repositories/UrlRepository';
import { mockUrls } from '../../fixtures/urls';

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn()
}));

describe('UrlRepository', () => {
  let urlRepository: UrlRepository;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    // Create mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      on: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      listeners: jest.fn(),
      rawListeners: jest.fn(),
      emit: jest.fn(),
      listenerCount: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      eventNames: jest.fn()
    };
    
    // Mock Pool constructor
    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);
    
    // Create repository instance
    urlRepository = new UrlRepository();
  });

  describe('create', () => {
    it('should create a new URL successfully', async () => {
      const urlData = mockUrls[0];
      const mockResult = {
        rows: [{
          id: urlData.id,
          original_url: urlData.originalUrl,
          short_slug: urlData.shortSlug,
          click_count: urlData.clickCount,
          created_at: urlData.createdAt,
          updated_at: urlData.updatedAt,
          user_id: urlData.userId
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.create(urlData);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO urls'),
        expect.arrayContaining([
          urlData.id,
          urlData.originalUrl,
          urlData.shortSlug,
          urlData.clickCount,
          urlData.createdAt,
          urlData.updatedAt,
          urlData.userId
        ])
      );
      expect(result).toEqual(urlData);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors during creation', async () => {
      const urlData = mockUrls[0];
      const dbError = new Error('Database connection failed');

      mockClient.query.mockRejectedValue(dbError);

      await expect(urlRepository.create(urlData)).rejects.toThrow('Database connection failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('should find URL by slug successfully', async () => {
      const slug = 'abc123';
      const urlData = mockUrls[0];
      const mockResult = {
        rows: [{
          id: urlData.id,
          original_url: urlData.originalUrl,
          short_slug: urlData.shortSlug,
          click_count: urlData.clickCount,
          created_at: urlData.createdAt,
          updated_at: urlData.updatedAt,
          user_id: urlData.userId
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.findBySlug(slug);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM urls WHERE short_slug = $1'),
        [slug]
      );
      expect(result).toEqual(urlData);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null when URL not found', async () => {
      const slug = 'nonexistent';
      const mockResult = { rows: [] };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.findBySlug(slug);

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find URL by ID successfully', async () => {
      const id = '550e8400-e29b-41d4-a716-446655440001';
      const urlData = mockUrls[0];
      const mockResult = {
        rows: [{
          id: urlData.id,
          original_url: urlData.originalUrl,
          short_slug: urlData.shortSlug,
          click_count: urlData.clickCount,
          created_at: urlData.createdAt,
          updated_at: urlData.updatedAt,
          user_id: urlData.userId
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.findById(id);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM urls WHERE id = $1'),
        [id]
      );
      expect(result).toEqual(urlData);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null when URL not found by ID', async () => {
      const id = 'nonexistent-id';
      const mockResult = { rows: [] };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.findById(id);

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('incrementClickCount', () => {
    it('should increment click count successfully', async () => {
      const slug = 'abc123';
      const mockResult = {
        rows: [{ click_count: 6 }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.incrementClickCount(slug);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE urls SET click_count = click_count + 1'),
        [slug]
      );
      expect(result).toBe(6);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle errors during click count increment', async () => {
      const slug = 'abc123';
      const dbError = new Error('Update failed');

      mockClient.query.mockRejectedValue(dbError);

      await expect(urlRepository.incrementClickCount(slug)).rejects.toThrow('Update failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getTotalUrlCount', () => {
    it('should return total URL count successfully', async () => {
      const mockResult = {
        rows: [{ count: '100' }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.getTotalUrlCount();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM urls')
      );
      expect(result).toBe(100);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getTotalClickCount', () => {
    it('should return total click count successfully', async () => {
      const mockResult = {
        rows: [{ total_clicks: '500' }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.getTotalClickCount();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT SUM(click_count) as total_clicks FROM urls')
      );
      expect(result).toBe(500);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getPopularUrls', () => {
    it('should return popular URLs successfully', async () => {
      const limit = 5;
      const mockResult = {
        rows: mockUrls.slice(0, 3).map(url => ({
          id: url.id,
          original_url: url.originalUrl,
          short_slug: url.shortSlug,
          click_count: url.clickCount,
          created_at: url.createdAt,
          updated_at: url.updatedAt,
          user_id: url.userId
        }))
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.getPopularUrls(limit);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM urls ORDER BY click_count DESC LIMIT $1'),
        [limit]
      );
      expect(result).toHaveLength(3);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getRecentUrls', () => {
    it('should return recent URLs successfully', async () => {
      const limit = 5;
      const mockResult = {
        rows: mockUrls.slice(0, 3).map(url => ({
          id: url.id,
          original_url: url.originalUrl,
          short_slug: url.shortSlug,
          click_count: url.clickCount,
          created_at: url.createdAt,
          updated_at: url.updatedAt,
          user_id: url.userId
        }))
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.getRecentUrls(limit);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM urls ORDER BY created_at DESC LIMIT $1'),
        [limit]
      );
      expect(result).toHaveLength(3);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('deleteBySlug', () => {
    it('should delete URL by slug successfully', async () => {
      const slug = 'abc123';
      const mockResult = {
        rowCount: 1
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.deleteBySlug(slug);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM urls WHERE short_slug = $1'),
        [slug]
      );
      expect(result).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return false when URL not found for deletion', async () => {
      const slug = 'nonexistent';
      const mockResult = {
        rowCount: 0
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await urlRepository.deleteBySlug(slug);

      expect(result).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
}); 