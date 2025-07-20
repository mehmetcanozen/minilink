import {
  generateUniqueSlug,
  generateSlug,
  generateSlugs,
  isValidSlug,
  estimateCollisionProbability,
  getSlugConfig,
  createSlugChecker,
  generateReadableSlug
} from '../../../src/utils/slugGenerator';
import { SlugGenerationError } from '../../../src/types';

// Mock the config module
jest.mock('../../../src/config', () => ({
  nanoidConfig: {
    alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    length: 7
  }
}));

// Mock the nanoid module - need to use a factory function to avoid hoisting issues
jest.mock('nanoid', () => {
  const mockGenerateId = jest.fn();
  return {
    nanoid: jest.fn(),
    customAlphabet: jest.fn(() => mockGenerateId),
    __mockGenerateId: mockGenerateId // Export for access in tests
  };
});

describe('SlugGenerator', () => {
  let mockGenerateId: jest.Mock;
  
  beforeAll(() => {
    // Get the mock function from the mocked module
    const nanoidMock = require('nanoid');
    mockGenerateId = nanoidMock.__mockGenerateId;
  });
  
  beforeEach(() => {
    mockGenerateId.mockClear();
    jest.clearAllMocks();
  });

  describe('generateSlug', () => {
    it('should generate a valid slug', () => {
      mockGenerateId.mockReturnValue('abc123');
      
      const result = generateSlug();
      
      expect(result).toBe('abc123');
      expect(mockGenerateId).toHaveBeenCalledTimes(1);
    });

    it('should throw error if generated slug is invalid', () => {
      mockGenerateId.mockReturnValue('ab'); // Too short
      
      expect(() => generateSlug()).toThrow(SlugGenerationError);
    });
  });

  describe('generateSlugs', () => {
    it('should generate multiple slugs', () => {
      mockGenerateId
        .mockReturnValueOnce('slug1')
        .mockReturnValueOnce('slug2')
        .mockReturnValueOnce('slug3');

      const result = generateSlugs(3);

      expect(result).toEqual(['slug1', 'slug2', 'slug3']);
      expect(mockGenerateId).toHaveBeenCalledTimes(3);
    });

    it('should return empty array for count 0', () => {
      const result = generateSlugs(0);
      expect(result).toEqual([]);
      expect(mockGenerateId).not.toHaveBeenCalled();
    });

    it('should return empty array for negative count', () => {
      const result = generateSlugs(-1);
      expect(result).toEqual([]);
      expect(mockGenerateId).not.toHaveBeenCalled();
    });

    it('should throw error for count > 1000', () => {
      expect(() => generateSlugs(1001)).toThrow(SlugGenerationError);
    });

    it('should throw error if any slug generation fails', () => {
      mockGenerateId
        .mockReturnValueOnce('slug1')
        .mockImplementationOnce(() => { throw new Error('Generation failed'); });

      expect(() => generateSlugs(2)).toThrow(SlugGenerationError);
    });
  });

  describe('generateUniqueSlug', () => {
    it('should generate unique slug without checker', async () => {
      mockGenerateId.mockReturnValue('test123');

      const result = await generateUniqueSlug();

      expect(result).toBe('test123');
      expect(mockGenerateId).toHaveBeenCalledTimes(1);
    });

    it('should generate unique slug with checker that returns false', async () => {
      mockGenerateId.mockReturnValue('test123');
      const mockChecker = jest.fn().mockResolvedValue(false);

      const result = await generateUniqueSlug({ 
        existingSlugChecker: mockChecker 
      });

      expect(result).toBe('test123');
      expect(mockChecker).toHaveBeenCalledWith('test123');
    });

    it('should retry when checker returns true (slug exists)', async () => {
      mockGenerateId
        .mockReturnValueOnce('exists123')
        .mockReturnValueOnce('unique456');
      
      const mockChecker = jest.fn()
        .mockResolvedValueOnce(true)  // First slug exists
        .mockResolvedValueOnce(false); // Second slug is unique

      const result = await generateUniqueSlug({ 
        existingSlugChecker: mockChecker 
      });

      expect(result).toBe('unique456');
      expect(mockChecker).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockGenerateId.mockReturnValue('taken123');
      const mockChecker = jest.fn().mockResolvedValue(true); // Always exists

      await expect(
        generateUniqueSlug({ 
          maxRetries: 3, 
          existingSlugChecker: mockChecker 
        })
      ).rejects.toThrow(SlugGenerationError);

      expect(mockChecker).toHaveBeenCalledTimes(3);
    });

    it('should retry on invalid slug generation', async () => {
      mockGenerateId
        .mockReturnValueOnce('ab') // Invalid (too short)
        .mockReturnValueOnce('valid123'); // Valid

      const result = await generateUniqueSlug();

      expect(result).toBe('valid123');
      expect(mockGenerateId).toHaveBeenCalledTimes(2);
    });

    it('should handle checker errors gracefully by continuing retries', async () => {
      mockGenerateId
        .mockReturnValueOnce('error123')
        .mockReturnValueOnce('success456');
      
      const mockChecker = jest.fn()
        .mockRejectedValueOnce(new Error('Checker error'))
        .mockResolvedValueOnce(false);

      const result = await generateUniqueSlug({ 
        existingSlugChecker: mockChecker 
      });

      expect(result).toBe('success456');
    });
  });

  describe('isValidSlug', () => {
    it('should validate correct slugs', () => {
      // Only characters from the nanoid alphabet (no hyphens or underscores allowed)
      const validSlugs = ['abcd', 'test123', 'MyCustomSlug', 'a1B2c3D4'];
      
      validSlugs.forEach(slug => {
        expect(isValidSlug(slug)).toBe(true);
      });
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        '',           // Empty
        'a',          // Too short
        'ab',         // Too short 
        'abc',        // Too short
        'a'.repeat(21), // Too long
        'invalid spaces',  // Spaces
        'special@chars',   // Special chars
        'test.slug',      // Dots
        'api',           // Reserved
        'admin',         // Reserved
        'www',           // Reserved
        'app'            // Reserved
      ];

      invalidSlugs.forEach(slug => {
        expect(isValidSlug(slug)).toBe(false);
      });
    });

    it('should handle non-string inputs', () => {
      expect(isValidSlug(null as any)).toBe(false);
      expect(isValidSlug(undefined as any)).toBe(false);
      expect(isValidSlug(123 as any)).toBe(false);
      expect(isValidSlug({} as any)).toBe(false);
    });

    it('should check reserved prefixes case-insensitively', () => {
      expect(isValidSlug('apitest')).toBe(false);
      expect(isValidSlug('admintest')).toBe(false);
      expect(isValidSlug('wwwtest')).toBe(false);
      expect(isValidSlug('apptest')).toBe(false);
    });
  });

  describe('estimateCollisionProbability', () => {
    it('should return 0 for 0 existing URLs', () => {
      const probability = estimateCollisionProbability(0);
      expect(probability).toBe(0);
    });

    it('should return low probability for small counts', () => {
      const probability = estimateCollisionProbability(100);
      expect(probability).toBeGreaterThan(0);
      expect(probability).toBeLessThan(0.1);
    });

    it('should return higher probability for larger counts', () => {
      const probability = estimateCollisionProbability(10000);
      expect(probability).toBeGreaterThan(0);
      expect(probability).toBeLessThan(1);
    });

    it('should cap probability at 1', () => {
      const probability = estimateCollisionProbability(Number.MAX_SAFE_INTEGER);
      expect(probability).toBe(1);
    });
  });

  describe('getSlugConfig', () => {
    it('should return correct configuration information', () => {
      const config = getSlugConfig();

      expect(config).toHaveProperty('alphabet');
      expect(config).toHaveProperty('alphabetSize');
      expect(config).toHaveProperty('slugLength');
      expect(config).toHaveProperty('totalPossibleSlugs');
      expect(config).toHaveProperty('safeGenerationLimit');

      expect(config.alphabetSize).toBeGreaterThan(0);
      expect(config.slugLength).toBeGreaterThan(0);
      expect(config.totalPossibleSlugs).toBeGreaterThan(0);
      expect(config.safeGenerationLimit).toBeGreaterThan(0);
    });
  });

  describe('createSlugChecker', () => {
    it('should create a function that checks slug existence', async () => {
      const mockRepository = {
        findBySlug: jest.fn().mockResolvedValue({ id: '123' })
      };

      const checker = createSlugChecker(mockRepository);
      const result = await checker('test123');

      expect(result).toBe(true);
      expect(mockRepository.findBySlug).toHaveBeenCalledWith('test123');
    });

    it('should return false when slug does not exist', async () => {
      const mockRepository = {
        findBySlug: jest.fn().mockResolvedValue(null)
      };

      const checker = createSlugChecker(mockRepository);
      const result = await checker('test123');

      expect(result).toBe(false);
    });

    it('should return true on repository error (safe default)', async () => {
      const mockRepository = {
        findBySlug: jest.fn().mockRejectedValue(new Error('DB error'))
      };

      const checker = createSlugChecker(mockRepository);
      const result = await checker('test123');

      expect(result).toBe(true); // Safe default
    });
  });

  describe('generateReadableSlug', () => {
    beforeEach(() => {
      mockGenerateId.mockReturnValue('fallback123');
    });

    it('should generate readable slug from simple URL', () => {
      const result = generateReadableSlug('https://example.com');
      expect(result).toBe('example-com');
    });

    it('should generate readable slug from URL with path', () => {
      const result = generateReadableSlug('https://github.com/user/repo');
      expect(result).toBe('github-com-user-repo');
    });

    it('should remove www prefix', () => {
      const result = generateReadableSlug('https://www.example.com/path');
      expect(result).toBe('example-com-path');
    });

    it('should clean up special characters', () => {
      const result = generateReadableSlug('https://test.com/hello-world!@#$%^&*()');
      expect(result).toBe('test-com-hello-world');
    });

    it('should limit length to 20 characters', () => {
      const longUrl = 'https://example.com/' + 'very-long-path'.repeat(10);
      const result = generateReadableSlug(longUrl);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should fallback to random slug for invalid URLs', () => {
      const result = generateReadableSlug('not-a-valid-url');
      expect(result).toBe('fallback123');
      expect(mockGenerateId).toHaveBeenCalled();
    });

    it('should fallback to random slug if result is too short', () => {
      // The URL 'https://a.co' results in 'a-co' (4 chars) which meets min length
      // Let's use a shorter domain that will definitely be too short
      const result = generateReadableSlug('https://a.b');
      expect(result).toBe('fallback123');
      expect(mockGenerateId).toHaveBeenCalled();
    });

    it('should handle URLs with query parameters', () => {
      const result = generateReadableSlug('https://search.com/query?q=test&page=1');
      expect(result).toBe('search-com-query');
    });

    it('should replace multiple consecutive hyphens', () => {
      const result = generateReadableSlug('https://test.com/path--with--dashes');
      expect(result).toBe('test-com-path-with-d');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = generateReadableSlug('https://test.com/-path-');
      expect(result).toBe('test-com-path');
    });
  });
}); 