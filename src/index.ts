import express from 'express';
import path from 'path';
import { config, serverConfig, validateConfig } from './config';
import { connectPrisma, disconnectPrisma, testPrismaConnection } from './config/prisma';
import { connectDatabase, disconnectDatabase, testDatabaseConnection } from './config/database';
import { connectRedis, disconnectRedis, testRedisConnection } from './config/redis';
import { initializeQueues, shutdownQueues, QueueManager } from './queues/QueueManager';
import { requestLogger, corsHeaders, requestSizeLimit, jsonParser, logger } from './middleware/logger';
import { getSecurityMiddleware, apiSecurity } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

// Create Express application
const app = express();

// Trust proxy (important for getting real IP addresses behind reverse proxies)
app.set('trust proxy', 1);

// View engine setup for EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply security middleware (Helmet + custom security)
const securityMiddleware = getSecurityMiddleware();
securityMiddleware.forEach(middleware => app.use(middleware));

// Static files
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Request logging
app.use(requestLogger);

// CORS headers
app.use(corsHeaders);

// Request size limiting
app.use(requestSizeLimit('10mb'));

// JSON parsing
app.use(jsonParser);

// API routes get additional security headers
app.use('/api', apiSecurity);

// Apply routes
app.use('/', routes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Global error handlers
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection', new Error(String(reason)), { promise: promise.toString() });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Starting graceful shutdown`, { signal });
  
  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Shutdown queues first (finish processing current jobs)
    logger.info('Shutting down queues...');
    await shutdownQueues();

    // Disconnect from Redis
    logger.info('Disconnecting from Redis...');
    await disconnectRedis();

    // Disconnect from database based on provider
    logger.info('Disconnecting from database...');
    if (config.database.provider === 'prisma') {
      await disconnectPrisma();
    } else {
      await disconnectDatabase();
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Server instance
let server: ReturnType<typeof app.listen> | null = null;

// Start server
async function startServer(): Promise<void> {
  try {
    logger.info('Starting MiniLink URL Shortener...');

    // Validate configuration
    validateConfig();

    // Connect to database based on provider
    logger.info(`Connecting to database via ${config.database.provider}...`);
    if (config.database.provider === 'prisma') {
      await connectPrisma();
      const prismaHealthy = await testPrismaConnection();
      if (!prismaHealthy) {
        throw new Error('Prisma connection test failed');
      }
    } else {
      await connectDatabase();
      const dbHealthy = await testDatabaseConnection();
      if (!dbHealthy) {
        throw new Error('Database connection test failed');
      }
    }

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis();
    
    // Test Redis connection
    const redisHealthy = await testRedisConnection();
    if (!redisHealthy) {
      throw new Error('Redis connection test failed');
    }

    // Initialize job queues
    logger.info('Initializing job queues...');
    const queueManager = await initializeQueues();

    // Set up queue workers
    await setupQueueWorkers(queueManager);

    // Warm up cache with popular URLs
    await warmUpCache();

    // Start HTTP server
    server = app.listen(serverConfig.port, () => {
      logger.info('🚀 MiniLink URL Shortener started successfully!', {
        port: serverConfig.port,
        database: `${config.database.provider} (${config.database.connectionString.split('@')[1]?.split('/')[0] || 'connection'})`,
        redis: `${config.redis.host}:${config.redis.port}`,
        environment: config.nodeEnv
      });
      
      console.log(`\n🚀 MiniLink URL Shortener started successfully!`);
      console.log(`📍 Server running on http://localhost:${serverConfig.port}`);
      console.log(`🗄️  Database: ${config.database.provider.toUpperCase()} (${config.database.connectionString.split('@')[1]?.split('/')[0] || 'connection'})`);
      console.log(`🔴 Redis: Connected and ready`);
      console.log(`⚡ Job queues: Active and processing`);
      console.log(`🛡️  Security: Enhanced with Helmet`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`\n📚 API Documentation available at: http://localhost:${serverConfig.port}/api`);
      console.log(`🎨 Web Interface available at: http://localhost:${serverConfig.port}`);
      console.log('\n✅ Ready to shorten URLs!\n');
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Setup queue workers
async function setupQueueWorkers(queueManager: QueueManager): Promise<void> {
  try {
    // Import job handlers dynamically to avoid circular dependencies
    const { ClickProcessingJobHandler } = await import('./queues/handlers/ClickProcessingJobHandler');
    const { ExpiredUrlCleanupJobHandler } = await import('./queues/handlers/ExpiredUrlCleanupJobHandler');
    const { ShortCodePoolJobHandler } = await import('./queues/handlers/ShortCodePoolJobHandler');
    const { CacheSyncJobHandler } = await import('./queues/handlers/CacheSyncJobHandler');

    // Get dependencies from queue manager
    const { cacheService, urlRepository } = queueManager.getDependencies();

    // Create job handlers with dependency injection
    const clickHandler = new ClickProcessingJobHandler(cacheService, urlRepository);
    const expiredUrlHandler = new ExpiredUrlCleanupJobHandler(urlRepository, cacheService);
    const shortCodePoolHandler = new ShortCodePoolJobHandler();
    const cacheSyncHandler = new CacheSyncJobHandler(cacheService, urlRepository);

    // Set up click processing worker
    queueManager.createWorker(
      'click-processing',
      async (job: { data: unknown }) => {
        await clickHandler.process(job as Parameters<typeof clickHandler.process>[0]);
      }
    );

    // Set up expired URL cleanup worker
    queueManager.createWorker(
      'expired-url-cleanup',
      async (job: { data: unknown }) => {
        await expiredUrlHandler.process(job as Parameters<typeof expiredUrlHandler.process>[0]);
      }
    );

    // Set up short code pool worker
    queueManager.createWorker(
      'short-code-pool',
      async (job: { data: { count: number } }) => {
        await shortCodePoolHandler.process(job);
      }
    );

    // Set up cache sync worker
    queueManager.createWorker(
      'cache-sync',
      async (job: { data: { slug: string; operation: 'sync' | 'invalidate'; data?: Record<string, unknown> } }) => {
        await cacheSyncHandler.process(job);
      }
    );

    // Initialize the short code pool
    await shortCodePoolHandler.initializePool();

    logger.info('Queue workers set up successfully');

    // Start periodic queue maintenance and expired URL cleanup
    startQueueMaintenance(queueManager);
    startExpiredUrlCleanup(queueManager);

  } catch (error) {
    logger.error('Failed to setup queue workers', error as Error);
    throw error;
  }
}

// Periodic queue maintenance
function startQueueMaintenance(queueManager: QueueManager): void {
  // Clean old jobs based on configurable interval
  setInterval(async () => {
    try {
      logger.info('Running queue maintenance...');
      await queueManager.cleanQueue('click-processing');
      await queueManager.cleanQueue('short-code-pool');
      await queueManager.cleanQueue('cache-sync');
      await queueManager.cleanQueue('expired-url-cleanup');
      await queueManager.cleanQueue('cache-warm-up');
      logger.info('Queue maintenance completed');
    } catch (error) {
      logger.error('Queue maintenance failed', error as Error);
    }
  }, config.queue.maintenanceIntervalMs);

  // Queue health check based on configurable interval
  setInterval(async () => {
    try {
      const healthy = await queueManager.isHealthy();
      if (!healthy) {
        logger.warn('Queue health check failed');
      }
    } catch (error) {
      logger.error('Queue health check error', error as Error);
    }
  }, config.queue.healthCheckIntervalMs);
}

// Periodic expired URL cleanup
function startExpiredUrlCleanup(queueManager: QueueManager): void {
  // Run expired URL cleanup based on configurable interval
  setInterval(async () => {
    try {
      logger.info('Scheduling expired URL cleanup job...');
      
      await queueManager.addJob(
        'expired-url-cleanup',
        'cleanup-expired-urls',
        {
          timestamp: new Date().toISOString(),
          batchSize: 100,
        },
        {
          priority: 2, // Lower priority than click processing
          removeOnComplete: 10,
          removeOnFail: 5,
        }
      );
      
      logger.info('Expired URL cleanup job scheduled');
    } catch (error) {
      logger.error('Failed to schedule expired URL cleanup job', error as Error);
    }
  }, config.queue.expiredUrlCleanupIntervalMs);

  // Also run cleanup on startup (after configurable delay to let system stabilize)
  setTimeout(async () => {
    try {
      logger.info('Running initial expired URL cleanup...');
      
      await queueManager.addJob(
        'expired-url-cleanup',
        'initial-cleanup',
        {
          timestamp: new Date().toISOString(),
          batchSize: 200, // Larger batch for initial cleanup
        },
        {
          priority: 1,
          removeOnComplete: 1,
          removeOnFail: 1,
        }
      );
      
      logger.info('Initial expired URL cleanup job scheduled');
    } catch (error) {
      logger.error('Failed to schedule initial expired URL cleanup job', error as Error);
    }
  }, config.queue.initialCleanupDelayMs);
}

// Warm up cache with popular URLs
async function warmUpCache(): Promise<void> {
  try {
    const queueManager = await import('./queues/QueueManager').then(m => m.getQueueManager());
    
    // Add a job to warm up the cache
    await queueManager.addJob(
      'cache-warm-up',
      'warm-up-cache',
      {
        timestamp: new Date().toISOString(),
        batchSize: 100, // Warm up 100 popular URLs
      },
      {
        priority: 1, // High priority for startup
        removeOnComplete: 1,
        removeOnFail: 1,
      }
    );
    
    logger.info('Cache warm-up job scheduled');
  } catch (error) {
    logger.error('Failed to schedule cache warm-up job', error as Error);
  }
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 