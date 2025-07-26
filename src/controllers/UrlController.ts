import { Request, Response } from 'express';
import { UrlService } from '../services/UrlService';
import { CreateUrlResponseDto, ApiResponse, ErrorResponse, InvalidUrlError } from '../types';
import { 
  createUrlSchema, 
  slugSchema, 
  urlQuerySchema,
  systemStatsSchema,
  CreateUrlDto,
  UrlQueryDto,
  SystemStatsDto
} from '../schemas/url.schema';
import { logger } from '../middleware/logger';
import { z } from 'zod';

export class UrlController {
  constructor(private urlService: UrlService) {}

  // Bind methods to preserve 'this' context
  bindMethods(): UrlController {
    this.createShortUrl = this.createShortUrl.bind(this);
    this.redirectToOriginalUrl = this.redirectToOriginalUrl.bind(this);
    this.getUrlStats = this.getUrlStats.bind(this);
    this.deleteUrl = this.deleteUrl.bind(this);
    this.getPopularUrls = this.getPopularUrls.bind(this);
    this.getRecentUrls = this.getRecentUrls.bind(this);
    this.getSystemStats = this.getSystemStats.bind(this);
    this.createMultipleUrls = this.createMultipleUrls.bind(this);
    return this;
  }

  async createShortUrl(req: Request, res: Response): Promise<void> {
    try {
      const dto = this.validateCreateUrlDto(req.body);

      const result = await this.urlService.shortenUrl(dto);

      const response: ApiResponse<CreateUrlResponseDto> = {
        success: true,
        data: result,
      };

      logger.info('URL shortened successfully', { 
        originalUrl: dto.originalUrl.substring(0, 50) + '...', 
        shortSlug: result.shortSlug 
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create short URL', error as Error, { 
        originalUrl: req.body?.originalUrl?.substring(0, 50) + '...' 
      });
      throw error;
    }
  }

  async redirectToOriginalUrl(req: Request, res: Response): Promise<void> {
    try {
      const slug = this.validateSlug(req.params.slug);
      const userAgent = req.get('User-Agent');
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      const redirectInfo = await this.urlService.redirectUrl(slug, userAgent, ip);

      logger.info('URL redirect processed', { 
        slug, 
        clickCount: redirectInfo.clickCount,
        isExpired: redirectInfo.isExpired 
      });

      res.redirect(redirectInfo.originalUrl);
    } catch (error) {
      logger.error('Failed to redirect URL', error as Error, { slug: req.params.slug });
      throw error;
    }
  }

  async getUrlStats(req: Request, res: Response): Promise<void> {
    try {
      const slug = this.validateSlug(req.params.slug);

      const urlStats = await this.urlService.getUrlStats(slug);

      const response: ApiResponse<typeof urlStats> = {
        success: true,
        data: urlStats,
      };

      logger.info('URL stats retrieved', { slug });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to get URL stats', error as Error, { slug: req.params.slug });
      throw error;
    }
  }

  async deleteUrl(req: Request, res: Response): Promise<void> {
    try {
      const slug = this.validateSlug(req.params.slug);
      // TODO: Get userId from authenticated user context, not from request body
      const userId = req.body?.userId; // This should come from auth middleware

      await this.urlService.deleteUrl(slug, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
      };

      logger.info('URL deleted successfully', { slug, userId });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to delete URL', error as Error, { slug: req.params.slug });
      throw error;
    }
  }

  async getPopularUrls(req: Request, res: Response): Promise<void> {
    try {
      const query = this.validateUrlQuery(req.query);
      const urls = await this.urlService.getPopularUrls(query.limit);

      const response: ApiResponse<typeof urls> = {
        success: true,
        data: urls,
      };

      logger.info('Popular URLs retrieved', { limit: query.limit, count: urls.length });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to get popular URLs', error as Error);
      throw error;
    }
  }

  async getRecentUrls(req: Request, res: Response): Promise<void> {
    try {
      const query = this.validateUrlQuery(req.query);
      const urls = await this.urlService.getRecentUrls(query.limit);

      const response: ApiResponse<typeof urls> = {
        success: true,
        data: urls,
      };

      logger.info('Recent URLs retrieved', { limit: query.limit, count: urls.length });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to get recent URLs', error as Error);
      throw error;
    }
  }

  async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const query = this.validateSystemStatsQuery(req.query);
      const stats = await this.urlService.getSystemStats();

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
      };

      logger.info('System stats retrieved', { includeCache: query.includeCache, includeQueue: query.includeQueue });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to get system stats', error as Error);
      throw error;
    }
  }

  async createMultipleUrls(req: Request, res: Response): Promise<void> {
    try {
      if (!Array.isArray(req.body)) {
        const errorResponse: ApiResponse<ErrorResponse> = {
          success: false,
          error: {
            message: 'Request body must be an array of URLs',
            code: 'INVALID_REQUEST',
            timestamp: new Date().toISOString(),
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      const dtos: CreateUrlDto[] = [];
      const errors: string[] = [];

      for (let i = 0; i < req.body.length; i++) {
        try {
          const dto = this.validateCreateUrlDto(req.body[i]);
          dtos.push(dto);
        } catch (error) {
          const errorMessage = error instanceof z.ZodError 
            ? error.issues.map((e: z.ZodIssue) => e.message).join(', ')
            : error instanceof Error ? error.message : 'Invalid URL';
          errors.push(`Item ${i}: ${errorMessage}`);
        }
      }

      if (dtos.length === 0) {
        const errorResponse: ApiResponse<ErrorResponse> = {
          success: false,
          error: {
            message: 'No valid URLs provided',
            code: 'NO_VALID_URLS',
            details: { errors },
            timestamp: new Date().toISOString(),
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      const results = await this.urlService.createMultipleUrls(dtos);

      const response: ApiResponse<typeof results> = {
        success: true,
        data: results,
      };

      logger.info('Multiple URLs created successfully', { 
        requested: req.body.length, 
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length 
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create multiple URLs', error as Error, { count: req.body?.length });
      throw error;
    }
  }

  // Health check endpoint
  async healthCheck(req: Request, res: Response): Promise<void> {
    const response: ApiResponse<{ status: string; timestamp: string }> = {
      success: true,
      data: {
        status: 'OK',
        timestamp: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  }

  // Validation methods using Zod schemas
  private validateCreateUrlDto(data: unknown): CreateUrlDto {
    try {
      return createUrlSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues.map((e: z.ZodIssue) => e.message).join(', ');
        throw new InvalidUrlError(errorMessage);
      }
      throw error;
    }
  }

  private validateSlug(slug: string): string {
    try {
      return slugSchema.parse(slug);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues.map((e: z.ZodIssue) => e.message).join(', ');
        throw new InvalidUrlError(errorMessage);
      }
      throw error;
    }
  }

  private validateUrlQuery(query: unknown): UrlQueryDto {
    try {
      return urlQuerySchema.parse(query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues.map((e: z.ZodIssue) => e.message).join(', ');
        throw new InvalidUrlError(errorMessage);
      }
      throw error;
    }
  }

  private validateSystemStatsQuery(query: unknown): SystemStatsDto {
    try {
      return systemStatsSchema.parse(query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues.map((e: z.ZodIssue) => e.message).join(', ');
        throw new InvalidUrlError(errorMessage);
      }
      throw error;
    }
  }
} 