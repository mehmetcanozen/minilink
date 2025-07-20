import { Url } from '../../../src/models/Url';
import { InvalidUrlError } from '../../../src/types';
import { mockUrls, mockDatabaseRow } from '../../fixtures/urls';
import { TEST_CONSTANTS } from '../../helpers/setup';

describe('Url Model', () => {
  
  describe('Constructor', () => {
    it('should create a URL instance with valid data', () => {
      const urlData = mockUrls[0];
      const url = new Url(urlData);

      expect(url.id).toBe(urlData.id);
      expect(url.originalUrl).toBe(urlData.originalUrl);
      expect(url.shortSlug).toBe(urlData.shortSlug);
      expect(url.clickCount).toBe(urlData.clickCount);
      expect(url.createdAt).toEqual(urlData.createdAt);
      expect(url.updatedAt).toEqual(urlData.updatedAt);
      expect(url.userId).toBe(urlData.userId);
    });

    it('should validate URL data during construction', () => {
      const invalidData = {
        ...mockUrls[0],
        originalUrl: 'invalid-url'
      };

      expect(() => new Url(invalidData)).toThrow(InvalidUrlError);
    });

    it('should validate slug data during construction', () => {
      const invalidData = {
        ...mockUrls[0],
        shortSlug: 'ab' // Too short
      };

      expect(() => new Url(invalidData)).toThrow(InvalidUrlError);
    });

    it('should validate click count during construction', () => {
      const invalidData = {
        ...mockUrls[0],
        clickCount: -1 // Negative count
      };

      expect(() => new Url(invalidData)).toThrow(InvalidUrlError);
    });
  });

  describe('Static Factory Methods', () => {
    
    describe('create', () => {
      it('should create URL data with valid inputs', () => {
        const originalUrl = 'https://example.com';
        const shortSlug = 'test123';
        const userId = 'user123';

        const result = Url.create(originalUrl, shortSlug, userId);

        expect(result.originalUrl).toBe('https://example.com/'); // Normalized with trailing slash
        expect(result.shortSlug).toBe(shortSlug);
        expect(result.clickCount).toBe(0);
        expect(result.userId).toBe(userId);
      });

      it('should create URL data without user ID', () => {
        const originalUrl = 'https://example.com';
        const shortSlug = 'test123';

        const result = Url.create(originalUrl, shortSlug);

        expect(result.originalUrl).toBe('https://example.com/'); // Normalized with trailing slash
        expect(result.shortSlug).toBe(shortSlug);
        expect(result.clickCount).toBe(0);
        expect(result.userId).toBeUndefined();
      });

      it('should normalize URL during creation', () => {
        const originalUrl = 'HTTP://EXAMPLE.COM/Path';
        const shortSlug = 'test123';

        const result = Url.create(originalUrl, shortSlug);

        expect(result.originalUrl).toBe('http://example.com/Path');
      });

      it('should throw error for invalid URL', () => {
        expect(() => Url.create('invalid-url', 'test123')).toThrow(InvalidUrlError);
      });

      it('should throw error for invalid slug', () => {
        expect(() => Url.create('https://example.com', 'ab')).toThrow(InvalidUrlError);
      });
    });

    describe('fromDatabaseRow', () => {
      it('should create URL instance from database row', () => {
        const url = Url.fromDatabaseRow(mockDatabaseRow);

        expect(url.id).toBe(mockDatabaseRow.id);
        expect(url.originalUrl).toBe(mockDatabaseRow.original_url);
        expect(url.shortSlug).toBe(mockDatabaseRow.short_slug);
        expect(url.clickCount).toBe(parseInt(mockDatabaseRow.click_count));
        expect(url.createdAt).toEqual(new Date(mockDatabaseRow.created_at));
        expect(url.updatedAt).toEqual(new Date(mockDatabaseRow.updated_at));
        expect(url.userId).toBeUndefined();
      });
    });
  });

  describe('Business Logic Methods', () => {
    let url: Url;

    beforeEach(() => {
      url = new Url(mockUrls[0]);
    });

    describe('incrementClickCount', () => {
      it('should increment click count by 1', () => {
        const originalCount = url.clickCount;
        const originalUpdatedAt = url.updatedAt;

        url.incrementClickCount();

        expect(url.clickCount).toBe(originalCount + 1);
        expect(url.updatedAt).not.toEqual(originalUpdatedAt);
      });

      it('should update the updatedAt timestamp', () => {
        const originalUpdatedAt = url.updatedAt;
        
        // Small delay to ensure timestamp difference
        setTimeout(() => {
          url.incrementClickCount();
          expect(url.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        }, 1);
      });
    });

    describe('isOwnedBy', () => {
      it('should return true for matching user ID', () => {
        const userUrl = new Url(mockUrls[1]); // Has userId
        expect(userUrl.isOwnedBy('user123')).toBe(true);
      });

      it('should return false for different user ID', () => {
        const userUrl = new Url(mockUrls[1]); // Has userId
        expect(userUrl.isOwnedBy('different-user')).toBe(false);
      });

      it('should return true for anonymous URL and no user ID', () => {
        expect(url.isOwnedBy()).toBe(true); // url has no userId
      });

      it('should return false for anonymous URL and provided user ID', () => {
        expect(url.isOwnedBy('user123')).toBe(false); // url has no userId
      });
    });

    describe('getShortUrl', () => {
      it('should return full short URL with base URL', () => {
        const baseUrl = 'https://mini.link';
        const result = url.getShortUrl(baseUrl);
        
        expect(result).toBe(`${baseUrl}/${url.shortSlug}`);
      });

      it('should handle base URL with trailing slash', () => {
        const baseUrl = 'https://mini.link/';
        const result = url.getShortUrl(baseUrl);
        
        expect(result).toBe(`https://mini.link/${url.shortSlug}`);
      });
    });

    describe('getCreatedDaysAgo', () => {
      it('should return number of days since creation', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 5); // 5 days ago
        
        const oldUrl = new Url({
          ...mockUrls[0],
          createdAt: oldDate
        });

        const daysAgo = oldUrl.getCreatedDaysAgo();
        expect(daysAgo).toBeGreaterThanOrEqual(5);
        expect(daysAgo).toBeLessThanOrEqual(6); // Account for time differences
      });
    });
  });

  describe('URL Validation', () => {
    describe('validateOriginalUrl', () => {
      it('should accept valid URLs', () => {
        TEST_CONSTANTS.VALID_URLS.forEach(url => {
          expect(() => Url.validateOriginalUrl(url)).not.toThrow();
        });
      });

      it('should reject invalid URLs', () => {
        TEST_CONSTANTS.INVALID_URLS.forEach(url => {
          expect(() => Url.validateOriginalUrl(url)).toThrow(InvalidUrlError);
        });
      });

      it('should reject URLs with invalid protocols', () => {
        expect(() => Url.validateOriginalUrl('ftp://example.com')).toThrow(InvalidUrlError);
        expect(() => Url.validateOriginalUrl('javascript:alert("xss")')).toThrow(InvalidUrlError);
      });

      it('should reject URLs that are too long', () => {
        const longUrl = 'https://' + 'a'.repeat(2050) + '.com';
        expect(() => Url.validateOriginalUrl(longUrl)).toThrow(InvalidUrlError);
      });

      it('should reject empty or non-string URLs', () => {
        expect(() => Url.validateOriginalUrl('')).toThrow(InvalidUrlError);
        expect(() => Url.validateOriginalUrl(null as any)).toThrow(InvalidUrlError);
        expect(() => Url.validateOriginalUrl(undefined as any)).toThrow(InvalidUrlError);
        expect(() => Url.validateOriginalUrl(123 as any)).toThrow(InvalidUrlError);
      });
    });

    describe('validateShortSlug', () => {
      it('should accept valid slugs', () => {
        TEST_CONSTANTS.VALID_SLUGS.forEach(slug => {
          expect(() => Url.validateShortSlug(slug)).not.toThrow();
        });
      });

      it('should reject invalid slugs', () => {
        TEST_CONSTANTS.INVALID_SLUGS.forEach(slug => {
          expect(() => Url.validateShortSlug(slug)).toThrow(InvalidUrlError);
        });
      });

      it('should reject slugs with invalid characters', () => {
        expect(() => Url.validateShortSlug('test@slug')).toThrow(InvalidUrlError);
        expect(() => Url.validateShortSlug('test slug')).toThrow(InvalidUrlError);
        expect(() => Url.validateShortSlug('test.slug')).toThrow(InvalidUrlError);
      });

      it('should reject reserved slugs', () => {
        const reservedSlugs = ['api', 'admin', 'www', 'app'];
        reservedSlugs.forEach(slug => {
          expect(() => Url.validateShortSlug(slug)).toThrow(InvalidUrlError);
          expect(() => Url.validateShortSlug(slug.toUpperCase())).toThrow(InvalidUrlError);
        });
      });

      it('should reject slugs that are too short or too long', () => {
        expect(() => Url.validateShortSlug('abc')).toThrow(InvalidUrlError);
        expect(() => Url.validateShortSlug('a'.repeat(21))).toThrow(InvalidUrlError);
      });
    });
  });

  describe('URL Normalization', () => {
    it('should normalize protocol to lowercase', () => {
      const result = Url.normalizeUrl('HTTP://example.com');
      expect(result).toBe('http://example.com/'); // URL normalization adds trailing slash
    });

    it('should normalize hostname to lowercase', () => {
      const result = Url.normalizeUrl('https://EXAMPLE.COM');
      expect(result).toBe('https://example.com/'); // URL normalization adds trailing slash
    });

    it('should remove default ports', () => {
      expect(Url.normalizeUrl('http://example.com:80')).toBe('http://example.com/');
      expect(Url.normalizeUrl('https://example.com:443')).toBe('https://example.com/');
    });

    it('should preserve non-default ports', () => {
      expect(Url.normalizeUrl('http://example.com:8080')).toBe('http://example.com:8080/');
      expect(Url.normalizeUrl('https://example.com:8443')).toBe('https://example.com:8443/');
    });

    it('should handle normalization errors gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const result = Url.normalizeUrl(invalidUrl);
      expect(result).toBe(invalidUrl); // Should return original if normalization fails
    });
  });

  describe('Serialization', () => {
    describe('toDatabaseRow', () => {
      it('should convert to database row format', () => {
        const url = new Url(mockUrls[0]);
        const row = url.toDatabaseRow();

        expect(row.id).toBe(url.id);
        expect(row.original_url).toBe(url.originalUrl);
        expect(row.short_slug).toBe(url.shortSlug);
        expect(row.click_count).toBe(url.clickCount);
        expect(row.created_at).toBe(url.createdAt);
        expect(row.updated_at).toBe(url.updatedAt);
        expect(row.user_id).toBe(url.userId || null);
      });
    });

    describe('toJSON', () => {
      it('should convert to JSON format', () => {
        const url = new Url(mockUrls[0]);
        const json = url.toJSON();

        expect(json.id).toBe(url.id);
        expect(json.originalUrl).toBe(url.originalUrl);
        expect(json.shortSlug).toBe(url.shortSlug);
        expect(json.clickCount).toBe(url.clickCount);
        expect(json.createdAt).toBe(url.createdAt.toISOString());
        expect(json.updatedAt).toBe(url.updatedAt.toISOString());
        expect(json.userId).toBe(url.userId);
      });
    });
  });
}); 