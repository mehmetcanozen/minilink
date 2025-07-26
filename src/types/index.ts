// Core domain types for the URL shortener service

/**
 * Core URL entity representing a shortened URL in the system
 */
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

// ============================================================================
// Data Transfer Objects (DTOs)
// ============================================================================

/**
 * Input DTO for creating a new shortened URL
 */
export interface CreateUrlDto {
  originalUrl: string;
  expiresAt?: Date; // Optional expiration date
  userId?: string; // Optional user ID for future authenticated requests
}

/**
 * Response DTO for URL creation operations
 */
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

/**
 * DTO for URL redirection operations
 */
export interface UrlRedirectDto {
  originalUrl: string;
  clickCount: number;
  isExpired: boolean; // Indicate if URL has expired
}

/**
 * DTO for URL statistics
 */
export interface UrlStatsDto {
  id: string;
  originalUrl: string;
  shortSlug: string;
  shortUrl: string;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  isExpired: boolean;
  daysSinceCreation: number;
  userId?: string;
}

/**
 * DTO for system statistics
 */
export interface SystemStatsDto {
  totalUrls: number;
  totalClicks: number;
  averageClicksPerUrl: number;
  activeUrls: number;
  expiredUrls: number;
  timestamp: string;
}

/**
 * DTO for bulk URL creation
 */
export interface BulkCreateUrlDto {
  urls: CreateUrlDto[];
  options?: {
    skipDuplicates?: boolean;
    generateCustomSlugs?: boolean;
  };
}

/**
 * DTO for bulk URL creation response
 */
export interface BulkCreateUrlResponseDto {
  results: CreateUrlResponseDto[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
  };
}

// ============================================================================
// Repository Interfaces
// ============================================================================

/**
 * Repository interface for URL data persistence operations
 * Implements hexagonal architecture pattern for database abstraction
 */
export interface UrlRepository {
  // Core CRUD operations
  create(url: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity>;
  findBySlug(slug: string): Promise<UrlEntity | null>;
  findById(id: string): Promise<UrlEntity | null>;
  deleteBySlug(slug: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  
  // Click count operations
  incrementClickCount(slug: string): Promise<void>;
  bulkIncrementClickCount(slug: string, incrementAmount: number): Promise<void>;
  
  // Query operations
  findByOriginalUrl(originalUrl: string): Promise<UrlEntity | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<UrlEntity[]>;
  getTotalUrlCount(): Promise<number>;
  getTotalClickCount(): Promise<number>;
  getPopularUrls(limit: number): Promise<UrlEntity[]>;
  getRecentUrls(limit: number): Promise<UrlEntity[]>;
  
  // Bulk operations
  createMany(urls: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<UrlEntity[]>;
  
  // Expiration management
  getExpiredUrls(limit?: number): Promise<UrlEntity[]>;
  deleteExpiredUrls(): Promise<number>;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Service interface for URL shortening business logic
 * Implements domain-driven design patterns
 */
export interface UrlService {
  // Core URL operations
  shortenUrl(dto: CreateUrlDto): Promise<CreateUrlResponseDto>;
  redirectUrl(slug: string, userAgent?: string, ip?: string): Promise<UrlRedirectDto>;
  getUrlStats(slug: string): Promise<UrlStatsDto>;
  getUrlById(id: string): Promise<UrlEntity | null>;
  deleteUrl(slug: string, userId?: string): Promise<void>;
  
  // User-specific operations (for future auth)
  getUserUrls(userId: string, limit?: number, offset?: number): Promise<UrlEntity[]>;
  
  // Analytics and reporting
  getPopularUrls(limit?: number): Promise<UrlEntity[]>;
  getRecentUrls(limit?: number): Promise<UrlEntity[]>;
  getSystemStats(): Promise<SystemStatsDto>;
  
  // Bulk operations
  createMultipleUrls(urls: CreateUrlDto[]): Promise<CreateUrlResponseDto[]>;
  createBulkUrls(dto: BulkCreateUrlDto): Promise<BulkCreateUrlResponseDto>;
  
  // Maintenance operations
  cleanupExpiredUrls(): Promise<number>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  connectionString: string;
  provider: 'pg' | 'prisma';
  host?: string; // Legacy support
  port?: number; // Legacy support
  database?: string; // Legacy support
  username?: string; // Legacy support
  password?: string; // Legacy support
}

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
}

/**
 * Queue configuration interface
 */
export interface QueueConfig {
  maintenanceIntervalMs: number;
  healthCheckIntervalMs: number;
  expiredUrlCleanupIntervalMs: number;
  initialCleanupDelayMs: number;
}

/**
 * Server configuration interface
 */
export interface ServerConfig {
  port: number;
  host: string;
  baseUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  nodeEnv: string;
  server: ServerConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  queue: QueueConfig;
  nanoid: NanoidConfig;
}

/**
 * NanoID configuration interface
 */
export interface NanoidConfig {
  size: number;
  alphabet: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error class for application-specific errors
 */
export abstract class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when a URL is not found
 */
export class UrlNotFoundError extends AppError {
  constructor(slug: string) {
    super(
      `URL with slug '${slug}' not found`,
      'URL_NOT_FOUND',
      404,
      { slug }
    );
  }
}

/**
 * Error thrown when URL validation fails
 */
export class InvalidUrlError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'INVALID_URL',
      400,
      details
    );
  }
}

/**
 * Error thrown when slug generation fails
 */
export class SlugGenerationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'SLUG_GENERATION_ERROR',
      500,
      details
    );
  }
}

/**
 * Error thrown when a resource already exists
 */
export class DuplicateResourceError extends AppError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super(
      `Resource '${resource}' already exists`,
      'DUPLICATE_ERROR',
      409,
      { resource, ...details }
    );
  }
}

/**
 * Error thrown when a resource is not found
 */
export class ResourceNotFoundError extends AppError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super(
      `Resource '${resource}' not found`,
      'RESOURCE_NOT_FOUND',
      404,
      { resource, ...details }
    );
  }
}

/**
 * Error thrown when repository operations fail
 */
export class RepositoryError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      'REPOSITORY_ERROR',
      500,
      { originalError: originalError?.message, ...details }
    );
  }
}

/**
 * Error thrown when database connection fails
 */
export class DatabaseConnectionError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      'DATABASE_CONNECTION_ERROR',
      503,
      { originalError: originalError?.message, ...details }
    );
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      'CACHE_ERROR',
      500,
      { originalError: originalError?.message, ...details }
    );
  }
}

/**
 * Error thrown when queue operations fail
 */
export class QueueError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      'QUEUE_ERROR',
      500,
      { originalError: originalError?.message, ...details }
    );
  }
}

/**
 * Error thrown when rate limiting is exceeded
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    details?: Record<string, unknown>
  ) {
    super(
      message,
      'RATE_LIMITED',
      429,
      { retryAfter: 60, ...details }
    );
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { field, ...details }
    );
  }
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  meta?: {
    timestamp: string;
    version?: string;
    requestId?: string;
  };
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  meta: {
    timestamp: string;
    version?: string;
    requestId?: string;
    pagination: PaginationMeta;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for partial updates
 */
export type PartialUpdate<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Type for creating new entities
 */
export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for database results that might be null
 */
export type Maybe<T> = T | null;

/**
 * Type for optional fields
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Type for required fields
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// Queue and Job Types
// ============================================================================

/**
 * Base job interface
 */
export interface BaseJob {
  id: string;
  timestamp: string;
  retries?: number;
  priority?: number;
}

/**
 * Click processing job
 */
export interface ClickProcessingJob extends BaseJob {
  slug: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Cache sync job
 */
export interface CacheSyncJob extends BaseJob {
  slug: string;
  operation: 'sync' | 'invalidate';
  data?: Record<string, unknown>;
}

/**
 * Expired URL cleanup job
 */
export interface ExpiredUrlCleanupJob extends BaseJob {
  batchSize?: number;
}

/**
 * Short code pool job
 */
export interface ShortCodePoolJob extends BaseJob {
  count: number;
}

/**
 * Cache warm-up job
 */
export interface CacheWarmUpJob extends BaseJob {
  batchSize: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  environment: string;
  services: {
    database: {
      provider: string;
      healthy: boolean;
    };
    redis: {
      healthy: boolean;
    };
    queues: {
      healthy: boolean;
    };
  };
  overall: 'healthy' | 'unhealthy';
} 