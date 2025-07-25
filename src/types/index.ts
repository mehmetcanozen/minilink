// Core domain types for the URL shortener service

export interface UrlEntity {
  id: string;
  originalUrl: string;
  shortSlug: string;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // Optional expiration date
  userId?: string; // Nullable for future authentication
}

// Data Transfer Objects (DTOs)
export interface CreateUrlDto {
  originalUrl: string;
  expiresAt?: Date; // Optional expiration date
  userId?: string; // Optional user ID for authenticated requests
}

export interface CreateUrlResponseDto {
  id: string;
  originalUrl: string;
  shortUrl: string;
  shortSlug: string;
  clickCount: number;
  createdAt: Date;
  expiresAt?: Date; // Include expiration date in response
  userId?: string; // Include user ID in response
  error?: string; // Optional error message for batch operations
}

export interface UrlRedirectDto {
  originalUrl: string;
  clickCount: number;
  isExpired: boolean; // Indicate if URL has expired
}

// Repository interfaces for abstraction
export interface UrlRepository {
  create(url: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity>;
  findBySlug(slug: string): Promise<UrlEntity | null>;
  findById(id: string): Promise<UrlEntity | null>;
  incrementClickCount(slug: string): Promise<void>;
  bulkIncrementClickCount(slug: string, incrementAmount: number): Promise<void>;
  findByOriginalUrl(originalUrl: string): Promise<UrlEntity | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<UrlEntity[]>;
  deleteBySlug(slug: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  getTotalUrlCount(): Promise<number>;
  getTotalClickCount(): Promise<number>;
  getPopularUrls(limit: number): Promise<UrlEntity[]>;
  getRecentUrls(limit: number): Promise<UrlEntity[]>;
  createMany(urls: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<UrlEntity[]>;
}

// Service interfaces
export interface UrlService {
  shortenUrl(dto: CreateUrlDto): Promise<CreateUrlResponseDto>;
  redirectUrl(slug: string, userAgent?: string, ip?: string): Promise<UrlRedirectDto>;
  getUrlStats(slug: string): Promise<UrlEntity>;
  getUrlById(id: string): Promise<UrlEntity | null>;
  deleteUrl(slug: string, userId?: string): Promise<void>;
  getUserUrls(userId: string, limit?: number, offset?: number): Promise<UrlEntity[]>;
  getPopularUrls(limit?: number): Promise<UrlEntity[]>;
  getRecentUrls(limit?: number): Promise<UrlEntity[]>;
  getSystemStats(): Promise<Record<string, unknown>>;
  createMultipleUrls(urls: CreateUrlDto[]): Promise<CreateUrlResponseDto[]>;
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url?: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  baseUrl: string;
  database: DatabaseConfig;
}

export interface NanoidConfig {
  size: number;
  alphabet: string;
}

// Error types
export class UrlNotFoundError extends Error {
  constructor(slug: string) {
    super(`URL with slug '${slug}' not found`);
    this.name = 'UrlNotFoundError';
  }
}

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export class SlugGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlugGenerationError';
  }
}

// Generic API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} 