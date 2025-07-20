import { Router } from 'express';
import { UrlController } from '../controllers/UrlController';
import { ViewController } from '../controllers/ViewController';
import { UrlService } from '../services/UrlService';
import { UrlRepository } from '../repositories/UrlRepository';
import { asyncHandler } from '../middleware/errorHandler';
import { basicRateLimit } from '../middleware/logger';

// Create router instance
const router = Router();

// Initialize dependencies (Dependency Injection)
const urlRepository = new UrlRepository();
const urlService = new UrlService(urlRepository);
const urlController = new UrlController(urlService).bindMethods();
const viewController = new ViewController(urlService).bindMethods();

// Rate limiting for different endpoints
const createUrlRateLimit = basicRateLimit({ windowMs: 60000, maxRequests: 10 }); // 10 per minute for URL creation
const generalRateLimit = basicRateLimit({ windowMs: 60000, maxRequests: 100 }); // 100 per minute for general requests

// ============================================================================
// Frontend View Routes (Server-Side Rendered with EJS)
// ============================================================================

// GET / - Home page with URL shortener
router.get('/', generalRateLimit, asyncHandler(viewController.renderHome));

// GET /dashboard - Analytics dashboard
router.get('/dashboard', generalRateLimit, asyncHandler(viewController.renderDashboard));

// ============================================================================
// API Routes (prefixed with /api)
// ============================================================================

// POST /api/shorten - Create a short URL
router.post('/api/shorten', 
  createUrlRateLimit,
  asyncHandler(urlController.createShortUrl)
);

// GET /api/stats - Get system statistics
router.get('/api/stats', 
  generalRateLimit,
  asyncHandler(urlController.getSystemStats)
);

// GET /api/urls/popular - Get popular URLs
router.get('/api/urls/popular', 
  generalRateLimit,
  asyncHandler(urlController.getPopularUrls)
);

// GET /api/urls/recent - Get recent URLs  
router.get('/api/urls/recent', 
  generalRateLimit,
  asyncHandler(urlController.getRecentUrls)
);

// POST /api/urls/batch - Create multiple URLs (admin feature)
router.post('/api/urls/batch', 
  createUrlRateLimit,
  asyncHandler(urlController.createMultipleUrls)
);

// ============================================================================
// URL-specific routes (these handle the actual short URL functionality)
// ============================================================================

// GET /:slug/stats - URL statistics page (frontend view)
router.get('/:slug/stats', 
  generalRateLimit,
  asyncHandler(viewController.renderUrlStats)
);

// DELETE /:slug - Delete a URL (for future authentication)
router.delete('/:slug', 
  generalRateLimit,
  asyncHandler(urlController.deleteUrl)
);

// GET /:slug - Redirect to original URL (this should be last to avoid conflicts)
router.get('/:slug', 
  asyncHandler(urlController.redirectToOriginalUrl)
);

// ============================================================================
// Health and utility routes
// ============================================================================

// GET /health - Health check endpoint
router.get('/health', urlController.healthCheck);

// GET /api - API information endpoint
router.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'MiniLink URL Shortener API',
      version: '1.0.0',
      description: 'RESTful API for URL shortening service',
      endpoints: {
        shorten: 'POST /api/shorten',
        redirect: 'GET /:slug',
        stats: 'GET /:slug/stats',
        health: 'GET /health',
        systemStats: 'GET /api/stats',
        popular: 'GET /api/urls/popular',
        recent: 'GET /api/urls/recent',
      },
      documentation: 'Visit GitHub repository for full API documentation',
      frontend: 'Available at /',
      dashboard: 'Available at /dashboard',
    },
  });
});

export default router; 