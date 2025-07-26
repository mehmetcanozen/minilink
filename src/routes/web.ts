import { Router } from 'express';
import { ViewController } from '../controllers/ViewController';
import { UrlController } from '../controllers/UrlController';
import { UrlService } from '../services/UrlService';
import { CacheService } from '../services/CacheService';
import { PrismaUrlRepository } from '../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../config/prisma';
import { createRedisCache } from '../config/redis';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  generalRateLimit, 
  redirectRateLimit 
} from '../middleware/rateLimiting';
import { logger } from '../middleware/logger';

// Create web router instance
const router = Router();

// Lazy initialization of dependencies
let viewController: ViewController | null = null;
let urlController: UrlController | null = null;
let urlService: UrlService | null = null;

function getControllers() {
  if (!viewController || !urlController || !urlService) {
    const prismaClient = getPrismaClient();
    const urlRepository = new PrismaUrlRepository(prismaClient);
    const redisCache = createRedisCache();
    const cacheService = new CacheService(redisCache);
    urlService = new UrlService(urlRepository, cacheService);
    urlController = new UrlController(urlService).bindMethods();
    viewController = new ViewController(urlService).bindMethods();
  }
  return { viewController, urlController, urlService };
}

// Rate limiting is now handled by imported middleware

// ============================================================================
// Static Assets
// ============================================================================

// Favicon route (must be before slug route)
router.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

// ============================================================================
// Public Web Routes (No Authentication Required)
// ============================================================================

// Home page
router.get('/', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    const { viewController } = getControllers();
    await viewController.renderHome(req, res);
  })
);

// Dashboard page (public for now, can be protected later)
router.get('/dashboard', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    const { viewController } = getControllers();
    await viewController.renderDashboard(req, res);
  })
);

// ============================================================================
// Dynamic Routes (must be last to avoid conflicts)
// ============================================================================

// Get URL statistics (public)
router.get('/:slug/stats', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    const { viewController } = getControllers();
    await viewController.renderUrlStats(req, res);
  })
);

// Delete URL (requires authentication - will be handled by auth middleware)
router.delete('/:slug', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.deleteUrl(req, res);
  })
);

// Redirect to original URL (most used endpoint - high rate limit)
router.get('/:slug', 
  redirectRateLimit, 
  asyncHandler(async (req, res) => {
    const { urlController } = getControllers();
    await urlController.redirectToOriginalUrl(req, res);
  })
);

// ============================================================================
// 404 Handler for Web Routes
// ============================================================================

// Catch-all 404 handler for unmatched web routes
router.use('*', 
  generalRateLimit, 
  asyncHandler(async (req, res) => {
    logger.info('404 - Page not found', { 
      path: req.path, 
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    const { viewController } = getControllers();
    await viewController.render404(req, res);
  })
);

export default router; 