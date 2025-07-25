import { Request, Response, NextFunction } from 'express';
import { UrlService } from '../services/UrlService';
import { CreateUrlDto, CreateUrlResponseDto, ApiResponse, ErrorResponse } from '../types';

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

  async createShortUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = this.validateCreateUrlDto(req.body);

      const result = await this.urlService.shortenUrl(dto);

      const response: ApiResponse<CreateUrlResponseDto> = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async redirectToOriginalUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = this.validateSlug(req.params.slug);
      const userAgent = req.get('User-Agent');
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      const redirectInfo = await this.urlService.redirectUrl(slug, userAgent, ip);

      res.redirect(redirectInfo.originalUrl);
    } catch (error) {
      next(error);
    }
  }

  async getUrlStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = this.validateSlug(req.params.slug);

      const urlStats = await this.urlService.getUrlStats(slug);

      const response: ApiResponse<typeof urlStats> = {
        success: true,
        data: urlStats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = this.validateSlug(req.params.slug);

      await this.urlService.deleteUrl(slug);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getPopularUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const urls = await this.urlService.getPopularUrls(limit);

      const response: ApiResponse<typeof urls> = {
        success: true,
        data: urls,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getRecentUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const urls = await this.urlService.getRecentUrls(limit);

      const response: ApiResponse<typeof urls> = {
        success: true,
        data: urls,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getSystemStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.urlService.getSystemStats();

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async createMultipleUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!Array.isArray(req.body)) {
        const errorResponse: ApiResponse<ErrorResponse> = {
          success: false,
          error: {
            message: 'Request body must be an array of URLs',
            code: 'INVALID_REQUEST',
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
          errors.push(`Item ${i}: ${error instanceof Error ? error.message : 'Invalid URL'}`);
        }
      }

      if (dtos.length === 0) {
        const errorResponse: ApiResponse<ErrorResponse> = {
          success: false,
          error: {
            message: 'No valid URLs provided',
            code: 'NO_VALID_URLS',
            details: { errors },
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

      res.status(201).json(response);
    } catch (error) {
      next(error);
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

  // Validation methods
  private validateCreateUrlDto(data: unknown): CreateUrlDto {
    if (!data || typeof data !== 'object') {
      throw new Error('Request body must be an object');
    }

    const { originalUrl, userId, expiresAt } = data as Record<string, unknown>;

    if (!originalUrl || typeof originalUrl !== 'string') {
      throw new Error('originalUrl is required and must be a string');
    }

    if (originalUrl.trim().length === 0) {
      throw new Error('originalUrl cannot be empty');
    }

    // Basic URL validation
    try {
      new URL(originalUrl);
    } catch {
      throw new Error('originalUrl must be a valid URL');
    }

    // Validate expiresAt if provided
    let parsedExpiresAt: Date | undefined;
    if (expiresAt) {
      if (typeof expiresAt === 'string') {
        parsedExpiresAt = new Date(expiresAt);
        if (isNaN(parsedExpiresAt.getTime())) {
          throw new Error('expiresAt must be a valid date string');
        }
      } else if (expiresAt instanceof Date) {
        parsedExpiresAt = expiresAt;
      } else {
        throw new Error('expiresAt must be a valid date string or Date object');
      }
    }

    return {
      originalUrl: originalUrl.trim(),
      expiresAt: parsedExpiresAt,
      userId: userId && typeof userId === 'string' ? userId : undefined,
    };
  }

  private validateSlug(slug: string): string {
    if (!slug || typeof slug !== 'string') {
      throw new Error('Slug is required and must be a string');
    }

    if (slug.trim().length === 0) {
      throw new Error('Slug cannot be empty');
    }

    // More permissive slug validation (alphanumeric, hyphens, underscores, dots)
    if (!/^[a-zA-Z0-9._-]+$/.test(slug)) {
      throw new Error('Slug contains invalid characters');
    }

    return slug.trim();
  }
} 