import { Router } from 'express';
import { UrlController } from '../controllers/UrlController';
import { ViewController } from '../controllers/ViewController';
import { UrlService } from '../services/UrlService';
import { PrismaUrlRepository } from '../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../config/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { basicRateLimit } from '../middleware/logger';

// Create router instance
const router = Router();

// Lazy initialization of dependencies
let urlController: UrlController | null = null;
let viewController: ViewController | null = null;
let urlService: UrlService | null = null;

function getControllers() {
  if (!urlController || !viewController || !urlService) {
    const prismaClient = getPrismaClient();
    const urlRepository = new PrismaUrlRepository(prismaClient);
    urlService = new UrlService(urlRepository);
    urlController = new UrlController(urlService).bindMethods();
    viewController = new ViewController(urlService).bindMethods();
  }
  return { urlController, viewController, urlService };
}

// Rate limiting for different endpoints
const createUrlRateLimit = basicRateLimit({ windowMs: 60000, maxRequests: 10 }); // 10 per minute for URL creation
const generalRateLimit = basicRateLimit({ windowMs: 60000, maxRequests: 100 }); // 100 per minute for general requests

// ============================================================================
// Health Check & API Documentation (must be first to avoid conflicts)
// ============================================================================

// Favicon route (must be before slug route)
router.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check Redis health
    const { createRedisCache } = await import('../config/redis');
    const redisCache = createRedisCache();
    const redisHealthy = await redisCache.isHealthy();
    
    // Check BullMQ health
    const { initializeQueues } = await import('../queues/QueueManager');
    const queueManager = await initializeQueues();
    const queuesHealthy = await queueManager.isHealthy();
    
    // Check Prisma health
    const { testPrismaConnection } = await import('../config/prisma');
    const prismaHealthy = await testPrismaConnection();
    
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: {
            provider: 'Prisma ORM',
            healthy: prismaHealthy,
          },
          redis: {
            provider: 'Redis Cache',
            healthy: redisHealthy,
          },
          queues: {
            provider: 'BullMQ',
            healthy: queuesHealthy,
          }
        }
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// API documentation endpoint
router.get('/api', (req, res) => {
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
        'POST /api/shorten': 'Create a short URL (supports expiresAt field)',
        'GET /:slug': 'Redirect to original URL (checks expiration)',
        'GET /:slug/stats': 'Get URL statistics (includes expiration info)',
        'DELETE /:slug': 'Delete a URL',
        'GET /api/stats': 'Get system statistics',
        'GET /api/urls/popular': 'Get popular URLs',
        'GET /api/urls/recent': 'Get recent URLs',
        'POST /api/urls/batch': 'Create multiple URLs',
        'GET /health': 'Health check (includes Redis and BullMQ status)',
        'GET /api/test/click/:slug': 'Test click processing (BullMQ)',
        'GET /api/test/cache/:slug': 'Test Redis cache',
        'POST /api/test/cleanup-expired': 'Manually trigger expired URL cleanup',
        'GET /api/queues/status': 'Get BullMQ queue status',
      },
      expiration: {
        description: 'URLs can be created with optional expiration dates',
        examples: {
          'No expiration': '{"originalUrl": "https://example.com"}',
          '1 day': '{"originalUrl": "https://example.com", "expiresAt": "2024-12-31T23:59:59.000Z"}',
          'Custom date': '{"originalUrl": "https://example.com", "expiresAt": "2024-06-30T12:00:00.000Z"}'
        }
      },
      documentation: 'Visit GitHub repository for full API documentation',
      frontend: 'Available at /',
      dashboard: 'Available at /dashboard',
    },
  });
});

// ============================================================================
// Frontend Routes (EJS Views)
// ============================================================================

// Home page
router.get('/', generalRateLimit, asyncHandler(async (req, res, next) => {
  const { viewController } = getControllers();
  await viewController.renderHome(req, res, next);
}));

// Dashboard page
router.get('/dashboard', generalRateLimit, asyncHandler(async (req, res, next) => {
  const { viewController } = getControllers();
  await viewController.renderDashboard(req, res, next);
}));

// ============================================================================
// API Routes
// ============================================================================

// Create short URL
router.post('/api/shorten', 
  createUrlRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.createShortUrl(req, res, next);
  })
);

// Get system statistics
router.get('/api/stats', 
  generalRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.getSystemStats(req, res, next);
  })
);

// Get popular URLs
router.get('/api/urls/popular', 
  generalRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.getPopularUrls(req, res, next);
  })
);

// Get recent URLs
router.get('/api/urls/recent', 
  generalRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.getRecentUrls(req, res, next);
  })
);

// Create multiple URLs (batch operation)
router.post('/api/urls/batch', 
  createUrlRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.createMultipleUrls(req, res, next);
  })
);

// ============================================================================
// Dynamic Routes (must be last to avoid conflicts)
// ============================================================================

// Get URL statistics
router.get('/:slug/stats', 
  generalRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { viewController } = getControllers();
    await viewController.renderUrlStats(req, res, next);
  })
);

// Delete URL
router.delete('/:slug', 
  generalRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.deleteUrl(req, res, next);
  })
);

// Redirect to original URL (most used endpoint)
router.get('/:slug', 
  generalRateLimit, 
  asyncHandler(async (req, res, next) => {
    const { urlController } = getControllers();
    await urlController.redirectToOriginalUrl(req, res, next);
  })
);

// ============================================================================
// Test Routes (for monitoring Redis/BullMQ)
// ============================================================================

// Test click processing (triggers BullMQ job)
router.get('/api/test/click/:slug', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    
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

// Test expired URL cleanup (triggers BullMQ job)
router.post('/api/test/cleanup-expired', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
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

// Test Redis cache
router.get('/api/test/cache/:slug', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
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

// Get BullMQ queue status
router.get('/api/queues/status', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
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

// Get short code pool status
router.get('/api/pool/status', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
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

// Get a slug from the pool (for testing)
router.get('/api/pool/get-slug', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
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

export default router; 