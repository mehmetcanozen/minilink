// Core domain types for the URL shortener service

export interface UrlEntity {
  id: string;
  originalUrl: string;
  shortSlug: string;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // Nullable for future authentication
}

// Data Transfer Objects (DTOs)
export interface CreateUrlDto {
  originalUrl: string;
}

export interface CreateUrlResponseDto {
  id: string;
  originalUrl: string;
  shortUrl: string;
  shortSlug: string;
  clickCount: number;
  createdAt: Date;
}

export interface UrlRedirectDto {
  originalUrl: string;
  clickCount: number;
}

// Repository interfaces for abstraction
export interface UrlRepository {
  create(url: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity>;
  findBySlug(slug: string): Promise<UrlEntity | null>;
  findById(id: string): Promise<UrlEntity | null>;
  incrementClickCount(slug: string): Promise<void>;
  findByOriginalUrl(originalUrl: string): Promise<UrlEntity | null>;
}

// Service interfaces
export interface UrlService {
  shortenUrl(dto: CreateUrlDto): Promise<CreateUrlResponseDto>;
  redirectUrl(slug: string): Promise<UrlRedirectDto | null>;
  getUrlStats(slug: string): Promise<UrlEntity | null>;
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
  nanoid: {
    alphabet: string;
    length: number;
  };
}

// Error types
export class UrlNotFoundError extends Error {
  constructor(slug: string) {
    super(`URL with slug '${slug}' not found`);
    this.name = 'UrlNotFoundError';
  }
}

export class InvalidUrlError extends Error {
  constructor(url: string) {
    super(`Invalid URL: '${url}'`);
    this.name = 'InvalidUrlError';
  }
}

export class SlugGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlugGenerationError';
  }
}

// HTTP Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
} 