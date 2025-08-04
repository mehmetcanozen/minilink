import { Router } from 'express';
import { UrlController } from '../controllers/UrlController';
import { HealthController } from '../controllers/HealthController';
import { UrlService } from '../services/UrlService';
import { CacheService } from '../services/CacheService';
import { PrismaUrlRepository } from '../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../config/prisma';
import { createRedisCache } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  createUrlRateLimit, 
  generalRateLimit, 
  adminRateLimit 
} from '../middleware/rateLimiting';
import { authenticateUser, requireAdmin, requireUser } from '../middleware/auth';
import { logger } from '../middleware/logger';

// Create API router instance
const router = Router();

// Lazy initialization of dependencies
let urlController: UrlController | null = null;
let urlService: UrlService | null = null;

function getControllers() {
  if (!urlController || !urlService) {
    const prismaClient = getPrismaClient();
    const urlRepository = new PrismaUrlRepository(prismaClient);
    const redisCache = createRedisCache();
    const cacheService = new CacheService(redisCache);
    urlService = new UrlService(urlRepository, cacheService);
    urlController = new UrlController(urlService).bindMethods();
  }
  return { urlController, urlService };
}

// Rate limiting is now handled by imported middleware

// ============================================================================
// API Documentation
// ============================================================================

// API documentation endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'MiniLink URL Shortener API',
      version: '1.0.0',
      description: 'A fast and scalable URL shortening service with URL expiration',
      database: 'Prisma ORM with PostgreSQL',
      features: [
        'URL shortening with custom expiration dates',
        'Real-time click counting with Redis',
        'Asynchronous job processing with BullMQ',
        'Automatic cleanup of expired URLs',
        'Comprehensive caching and performance optimization'
      ],
      endpoints: {
        'POST /shorten': 'Create a short URL (supports expiresAt field)',
        'GET /stats': 'Get system statistics',
        'GET /urls/popular': 'Get popular URLs',
        'GET /urls/recent': 'Get recent URLs',
        'POST /urls/batch': 'Create multiple URLs',
        'GET /health': 'Health check (includes Redis and BullMQ status)',
      },
      expiration: {
        description: 'URLs can be created with optional expiration dates',
        examples: {
          'No expiration': '{"originalUrl": "https://example.com"}',
          '1 day': '{"originalUrl": "https://example.com", "expiresAt": "2024-12-31T23:59:59.000Z"}',
          'Custom date': '{"originalUrl": "https://example.com", "expiresAt": "2024-06-30T12:00:00.000Z"}'
        }
      },
      authentication: {
        description: 'Most endpoints require authentication',
        note: 'Use Authorization header with Bearer token for authenticated requests'
      },
      documentation: 'Visit GitHub repository for full API documentation',
    },
  });
});

// ============================================================================
// Public API Routes (No Authentication Required)
// ============================================================================

// Health check endpoint (public)
router.get('/health', asyncHandler(HealthController.check));

// ============================================================================
// Authenticated API Routes
// ============================================================================

// Apply authentication middleware to all routes below this point
router.use(authenticateUser);

// Create short URL (authenticated)
router.post('/shorten', 
  createUrlRateLimit, 
  requireUser,
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.createShortUrl(req, res);
  })
);

// Get system statistics (admin only)
router.get('/stats', 
  adminRateLimit, 
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.getSystemStats(req, res);
  })
);

// Get individual URL statistics (authenticated)
router.get('/urls/:slug/stats', 
  generalRateLimit, 
  requireUser,
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.getUrlStats(req, res);
  })
);

// Get popular URLs (authenticated)
router.get('/urls/popular', 
  generalRateLimit, 
  requireUser,
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.getPopularUrls(req, res);
  })
);

// Get recent URLs (authenticated)
router.get('/urls/recent', 
  generalRateLimit, 
  requireUser,
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.getRecentUrls(req, res);
  })
);

// Create multiple URLs (batch operation) (authenticated)
router.post('/urls/batch', 
  createUrlRateLimit, 
  requireUser,
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.createMultipleUrls(req, res);
  })
);

// ============================================================================
// Admin-Only Routes (Development/Testing)
// ============================================================================

// Only expose admin routes in development environment
if (process.env.NODE_ENV === 'development') {
  
  // Test click processing (triggers BullMQ job) - Admin only
  router.get('/test/click/:slug', 
    adminRateLimit, 
    requireAdmin,
    asyncHandler(async (req, res) => {
      const slug = req.params.slug;
      
      logger.info('Manual click processing triggered', { slug, user: req.user?.id });
      
      // Manually trigger click processing
      const { urlService } = getControllers();
      await urlService.redirectUrl(slug, 'Test User Agent', '127.0.0.1');
      
      res.status(200).json({
        success: true,
        data: {
          message: `Click processing job queued for slug: ${slug}`,
          timestamp: new Date().toISOString(),
          note: 'Check server logs for BullMQ job processing'
        }
      });
    })
  );

  // Test expired URL cleanup (triggers BullMQ job) - Admin only
  router.post('/test/cleanup-expired', 
    adminRateLimit, 
    requireAdmin,
    asyncHandler(async (req, res) => {
      logger.info('Manual expired URL cleanup triggered', { user: req.user?.id });
      
      const { initializeQueues } = await import('../queues/QueueManager');
      const queueManager = await initializeQueues();
      
      const batchSize = req.body.batchSize || 50;
      
      await queueManager.addJob(
        'expired-url-cleanup',
        'manual-cleanup',
        {
          timestamp: new Date().toISOString(),
          batchSize,
        },
        {
          priority: 1,
          removeOnComplete: 1,
          removeOnFail: 1,
        }
      );
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Expired URL cleanup job queued',
          batchSize,
          timestamp: new Date().toISOString(),
          note: 'Check server logs for cleanup job processing'
        }
      });
    })
  );

  // Test Redis cache - Admin only
  router.get('/test/cache/:slug', 
    adminRateLimit, 
    requireAdmin,
    asyncHandler(async (req, res) => {
      const slug = req.params.slug;
      
      logger.info('Cache test requested', { slug, user: req.user?.id });
      
      const { urlService } = getControllers();
      
      // Get URL from service (this will use cache)
      const urlStats = await urlService.getUrlStats(slug);
      
      res.status(200).json({
        success: true,
        data: {
          slug,
          urlStats,
          message: 'URL retrieved (cache-first approach)',
          timestamp: new Date().toISOString()
        }
      });
    })
  );

  // Get BullMQ queue status - Admin only
  router.get('/queues/status', 
    adminRateLimit, 
    requireAdmin,
    asyncHandler(async (req, res) => {
      logger.info('Queue status requested', { user: req.user?.id });
      
      const { initializeQueues } = await import('../queues/QueueManager');
      const queueManager = await initializeQueues();
      const stats = await queueManager.getAllQueueStats();
      
      res.status(200).json({
        success: true,
        data: {
          queues: stats,
          timestamp: new Date().toISOString(),
          note: 'Shows active jobs, completed jobs, and failed jobs for each queue'
        }
      });
    })
  );

  // Get short code pool status - Admin only
  router.get('/pool/status', 
    adminRateLimit, 
    requireAdmin,
    asyncHandler(async (req, res) => {
      logger.info('Pool status requested', { user: req.user?.id });
      
      const { ShortCodePoolJobHandler } = await import('../queues/handlers/ShortCodePoolJobHandler');
      const poolHandler = new ShortCodePoolJobHandler();
      const stats = await poolHandler.getPoolStats();
      
      res.status(200).json({
        success: true,
        data: {
          pool: stats,
          timestamp: new Date().toISOString(),
          note: 'Shows available short codes in the pool'
        }
      });
    })
  );

  // Get a slug from the pool (for testing) - Admin only
  router.get('/pool/get-slug', 
    adminRateLimit, 
    requireAdmin,
    asyncHandler(async (req, res) => {
      logger.info('Pool slug retrieval requested', { user: req.user?.id });
      
      const { ShortCodePoolJobHandler } = await import('../queues/handlers/ShortCodePoolJobHandler');
      const poolHandler = new ShortCodePoolJobHandler();
      const slug = await poolHandler.getSlugFromPool();
      
      res.status(200).json({
        success: true,
        data: {
          slug,
          timestamp: new Date().toISOString(),
          note: slug ? 'Slug retrieved from pool' : 'No slugs available in pool'
        }
      });
    })
  );
}

export default router; 