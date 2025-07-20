import { Request, Response, NextFunction } from 'express';
import { UrlService } from '../services/UrlService';
import { 
  ApiResponse, 
  CreateUrlDto, 
  CreateUrlResponseDto, 
  InvalidUrlError, 
  UrlNotFoundError,
  ErrorResponse 
} from '../types';

export class UrlController {
  private urlService: UrlService;

  constructor(urlService: UrlService) {
    this.urlService = urlService;
  }

  // POST /shorten - Create a short URL
  async createShortUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const dto = UrlService.validateCreateUrlDto(req.body);
      
      // Get user ID from request (for future authentication)
      const userId = (req as any).userId; // Will be undefined for now

      // Create short URL
      const result = await this.urlService.shortenUrl(dto, userId);

      // Send success response
      const response: ApiResponse<CreateUrlResponseDto> = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /:slug - Redirect to original URL
  async redirectToOriginalUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate slug parameter
      const slug = UrlService.validateSlug(req.params.slug);

      // Get redirect information
      const redirectInfo = await this.urlService.redirectUrl(slug);

      if (!redirectInfo) {
        // URL not found
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'URL_NOT_FOUND',
            message: `Short URL '${slug}' not found`,
          },
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Perform redirect
      res.redirect(302, redirectInfo.originalUrl);
    } catch (error) {
      next(error);
    }
  }

  // GET /:slug/stats - Get URL statistics
  async getUrlStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate slug parameter
      const slug = UrlService.validateSlug(req.params.slug);

      // Get URL stats
      const stats = await this.urlService.getUrlStats(slug);

      if (!stats) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'URL_NOT_FOUND',
            message: `Short URL '${slug}' not found`,
          },
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Send stats response (excluding sensitive information)
      const response: ApiResponse<any> = {
        success: true,
        data: {
          id: stats.id,
          originalUrl: stats.originalUrl,
          shortSlug: stats.shortSlug,
          clickCount: stats.clickCount,
          createdAt: stats.createdAt,
          // Don't expose userId for privacy
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /:slug - Delete a URL (for future authentication)
  async deleteUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate slug parameter
      const slug = UrlService.validateSlug(req.params.slug);
      
      // Get user ID from request (for future authentication)
      const userId = (req as any).userId; // Will be undefined for now

      // Delete URL
      const deleted = await this.urlService.deleteUrl(slug, userId);

      if (!deleted) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'URL_NOT_FOUND',
            message: `Short URL '${slug}' not found`,
          },
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Send success response
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: {
          message: 'URL deleted successfully',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/urls/popular - Get popular URLs
  async getPopularUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (limit > 100) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit cannot exceed 100',
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      const popularUrls = await this.urlService.getPopularUrls(limit);

      // Filter out sensitive information
      const filteredUrls = popularUrls.map(url => ({
        id: url.id,
        originalUrl: url.originalUrl,
        shortSlug: url.shortSlug,
        clickCount: url.clickCount,
        createdAt: url.createdAt,
      }));

      const response: ApiResponse<typeof filteredUrls> = {
        success: true,
        data: filteredUrls,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/urls/recent - Get recent URLs
  async getRecentUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (limit > 100) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit cannot exceed 100',
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      const recentUrls = await this.urlService.getRecentUrls(limit);

      // Filter out sensitive information
      const filteredUrls = recentUrls.map(url => ({
        id: url.id,
        originalUrl: url.originalUrl,
        shortSlug: url.shortSlug,
        clickCount: url.clickCount,
        createdAt: url.createdAt,
      }));

      const response: ApiResponse<typeof filteredUrls> = {
        success: true,
        data: filteredUrls,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/stats - Get system statistics
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

  // POST /api/urls/batch - Create multiple URLs (for future admin features)
  async createMultipleUrls(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!Array.isArray(req.body)) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body must be an array of URLs',
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      if (req.body.length > 50) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 'TOO_MANY_URLS',
            message: 'Cannot create more than 50 URLs at once',
          },
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Validate each URL in the batch
      const dtos: CreateUrlDto[] = [];
      for (let i = 0; i < req.body.length; i++) {
        try {
          const dto = UrlService.validateCreateUrlDto(req.body[i]);
          dtos.push(dto);
        } catch (error) {
          const errorResponse: ErrorResponse = {
            success: false,
            error: {
              code: 'INVALID_URL',
              message: `Invalid URL at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          };
          res.status(400).json(errorResponse);
          return;
        }
      }

      // Get user ID from request (for future authentication)
      const userId = (req as any).userId; // Will be undefined for now

      // Create URLs
      const results = await this.urlService.createMultipleUrls(dtos, userId);

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

  // Bind all methods to ensure proper `this` context
  bindMethods(): UrlController {
    this.createShortUrl = this.createShortUrl.bind(this);
    this.redirectToOriginalUrl = this.redirectToOriginalUrl.bind(this);
    this.getUrlStats = this.getUrlStats.bind(this);
    this.deleteUrl = this.deleteUrl.bind(this);
    this.getPopularUrls = this.getPopularUrls.bind(this);
    this.getRecentUrls = this.getRecentUrls.bind(this);
    this.getSystemStats = this.getSystemStats.bind(this);
    this.createMultipleUrls = this.createMultipleUrls.bind(this);
    this.healthCheck = this.healthCheck.bind(this);
    
    return this;
  }
} 