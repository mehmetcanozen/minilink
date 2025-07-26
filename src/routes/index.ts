import { Router } from 'express';
import apiRoutes from './api';
import webRoutes from './web';
import { logger } from '../middleware/logger';

// Create main router instance
const router = Router();

// ============================================================================
// Route Organization
// ============================================================================

// API routes (all /api/* endpoints)
router.use('/api', apiRoutes);

// Web routes (public-facing pages and redirects)
router.use('/', webRoutes);

// ============================================================================
// Global Route Logging (Optional - for debugging)
// ============================================================================

// Log all requests for debugging (only in development)
if (process.env.NODE_ENV === 'development') {
  router.use((req, res, next) => {
    logger.debug('Route accessed', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 100)
    });
    next();
  });
}

export default router; 