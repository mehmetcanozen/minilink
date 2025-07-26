import { UrlEntity, InvalidUrlError } from '../types';

export class Url implements UrlEntity {
  id: string;
  originalUrl: string;
  shortSlug: string;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  userId?: string;

  // Constructor for rehydrating existing URL entities (e.g., from database or cache)
  constructor(data: UrlEntity) {
    this.id = data.id;
    this.originalUrl = data.originalUrl;
    this.shortSlug = data.shortSlug;
    this.clickCount = data.clickCount;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.expiresAt = data.expiresAt;
    this.userId = data.userId;

    this.validateUrl();
  }

  // Factory method to create a new URL instance for persistence
  // Use this for creating new URLs, not the constructor
  static create(originalUrl: string, shortSlug: string, userId?: string, expiresAt?: Date): Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'> {
    // Validate URL before creating
    Url.validateOriginalUrl(originalUrl);
    Url.validateShortSlug(shortSlug);
    Url.validateExpirationDate(expiresAt);

    return {
      originalUrl: Url.normalizeUrl(originalUrl),
      shortSlug,
      clickCount: 0,
      expiresAt: expiresAt || undefined,
      userId: userId || undefined,
    };
  }

  // Factory method to create instance from database row
  static fromDatabaseRow(row: Record<string, unknown>): Url {
    return new Url({
      id: row.id as string,
      originalUrl: row.original_url as string,
      shortSlug: row.short_slug as string,
      clickCount: parseInt(row.click_count as string, 10),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      userId: (row.user_id as string) || undefined,
    });
  }

  // Convert to database row format
  toDatabaseRow(): Record<string, unknown> {
    return {
      id: this.id,
      original_url: this.originalUrl,
      short_slug: this.shortSlug,
      click_count: this.clickCount,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      expires_at: this.expiresAt || null,
      user_id: this.userId || null,
    };
  }

  // Business logic methods
  incrementClickCount(): void {
    this.clickCount += 1;
    this.updatedAt = new Date();
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  isOwnedBy(userId?: string): boolean {
    return this.userId === userId;
  }

  getShortUrl(baseUrl: string): string {
    // Remove trailing slash from baseUrl if present
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    return `${cleanBaseUrl}/${this.shortSlug}`;
  }

  getCreatedDaysAgo(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  // Validation methods
  private validateUrl(): void {
    Url.validateOriginalUrl(this.originalUrl);
    Url.validateShortSlug(this.shortSlug);

    if (this.clickCount < 0) {
      throw new InvalidUrlError('Click count cannot be negative');
    }
  }

  static validateOriginalUrl(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new InvalidUrlError('URL is required and must be a string');
    }

    if (url.length > 2048) {
      throw new InvalidUrlError('URL is too long (maximum 2048 characters)');
    }

    // Basic URL validation
    try {
      const parsedUrl = new URL(url);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new InvalidUrlError('URL must use HTTP or HTTPS protocol');
      }

      // Check for valid hostname
      if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
        throw new InvalidUrlError('URL must have a valid hostname');
      }

    } catch (error) {
      if (error instanceof InvalidUrlError) {
        throw error;
      }
      throw new InvalidUrlError('Invalid URL format');
    }
  }

  static validateShortSlug(slug: string): void {
    if (!slug || typeof slug !== 'string') {
      throw new InvalidUrlError('Short slug is required and must be a string');
    }

    if (slug.length < 4 || slug.length > 20) {
      throw new InvalidUrlError('Short slug must be between 4 and 20 characters');
    }

    // Check for URL-safe characters only
    const urlSafeRegex = /^[A-Za-z0-9_-]+$/;
    if (!urlSafeRegex.test(slug)) {
      throw new InvalidUrlError('Short slug can only contain letters, numbers, hyphens, and underscores');
    }

    // Reserved slugs that shouldn't be used
    // IMPORTANT: Update this list when adding new routes to prevent conflicts
    const reservedSlugs = ['api', 'admin', 'www', 'app', 'help', 'about', 'contact', 'terms', 'privacy'];
    if (reservedSlugs.includes(slug.toLowerCase())) {
      throw new InvalidUrlError(`Short slug '${slug}' is reserved and cannot be used`);
    }
  }

  static validateExpirationDate(expiresAt?: Date): void {
    if (expiresAt && expiresAt < new Date()) {
      throw new InvalidUrlError('Expiration date cannot be in the past');
    }
  }

  // Utility method to normalize URL
  static normalizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      
      // Convert to lowercase for protocol and hostname
      parsedUrl.protocol = parsedUrl.protocol.toLowerCase();
      parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
      
      // Remove default ports
      if ((parsedUrl.protocol === 'http:' && parsedUrl.port === '80') ||
          (parsedUrl.protocol === 'https:' && parsedUrl.port === '443')) {
        parsedUrl.port = '';
      }
      
      // Remove trailing slash from pathname if it's just '/'
      if (parsedUrl.pathname === '/') {
        parsedUrl.pathname = '';
      }
      
      return parsedUrl.toString();
    } catch {
      // If normalization fails, return original URL
      return url;
    }
  }

  // Convert to JSON for API responses
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      originalUrl: this.originalUrl,
      shortSlug: this.shortSlug,
      clickCount: this.clickCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      expiresAt: this.expiresAt?.toISOString(),
      userId: this.userId,
    };
  }
} 