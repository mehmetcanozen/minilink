import express from 'express';
import path from 'path';
import { config, serverConfig, validateConfig } from './config';
import { connectPrisma, disconnectPrisma, testPrismaConnection } from './config/prisma';
import { connectRedis, disconnectRedis, testRedisConnection } from './config/redis';
import { initializeQueues, shutdownQueues, QueueManager } from './queues/QueueManager';
import { requestLogger, corsHeaders, requestSizeLimit, jsonParser } from './middleware/logger';
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
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
      });
    }

    // Shutdown queues first (finish processing current jobs)
    console.log('Shutting down queues...');
    await shutdownQueues();

    // Disconnect from Redis
    console.log('Disconnecting from Redis...');
    await disconnectRedis();

    // Disconnect from Prisma
    console.log('Disconnecting from Prisma...');
    await disconnectPrisma();

    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
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
    console.log('Starting MiniLink URL Shortener...');

    // Validate configuration
    validateConfig();

    // Connect to database via Prisma
    console.log('Connecting to database via Prisma...');
    await connectPrisma();
    
    const prismaHealthy = await testPrismaConnection();
    if (!prismaHealthy) {
      throw new Error('Prisma connection test failed');
    }

    // Connect to Redis
    console.log('Connecting to Redis...');
    await connectRedis();
    
    // Test Redis connection
    const redisHealthy = await testRedisConnection();
    if (!redisHealthy) {
      throw new Error('Redis connection test failed');
    }

    // Initialize job queues
    console.log('Initializing job queues...');
    const queueManager = await initializeQueues();

    // Set up queue workers
    await setupQueueWorkers(queueManager);

    // Start HTTP server
    server = app.listen(serverConfig.port, () => {
      console.log(`\n🚀 MiniLink URL Shortener started successfully!`);
      console.log(`📍 Server running on http://localhost:${serverConfig.port}`);
      console.log(`🗄️  Database: Prisma ORM (${config.database.host}:${config.database.port}/${config.database.database})`);
      console.log(`🔴 Redis: Connected and ready`);
      console.log(`⚡ Job queues: Active and processing`);
      console.log(`🛡️  Security: Enhanced with Helmet`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n📚 API Documentation available at: http://localhost:${serverConfig.port}/api`);
      console.log(`🎨 Web Interface available at: http://localhost:${serverConfig.port}`);
      console.log('\n✅ Ready to shorten URLs!\n');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Setup queue workers
async function setupQueueWorkers(queueManager: QueueManager): Promise<void> {
  try {
    // Import job handlers dynamically to avoid circular dependencies
    const { ClickProcessingJobHandler } = await import('./queues/handlers/ClickProcessingJobHandler');
    const { ExpiredUrlCleanupJobHandler } = await import('./queues/handlers/ExpiredUrlCleanupJobHandler');

    // Create job handlers
    const clickHandler = new ClickProcessingJobHandler();
    const expiredUrlHandler = new ExpiredUrlCleanupJobHandler();

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
    const { ShortCodePoolJobHandler } = await import('./queues/handlers/ShortCodePoolJobHandler');
    const shortCodePoolHandler = new ShortCodePoolJobHandler();
    
    queueManager.createWorker(
      'short-code-pool',
      async (job: { data: { count: number } }) => {
        await shortCodePoolHandler.process(job);
      }
    );

    // Initialize the short code pool
    await shortCodePoolHandler.initializePool();

    // Set up cache sync worker
    const { CacheSyncJobHandler } = await import('./queues/handlers/CacheSyncJobHandler');
    const cacheSyncHandler = new CacheSyncJobHandler();
    
    queueManager.createWorker(
      'cache-sync',
      async (job: { data: { slug: string; operation: 'sync' | 'invalidate'; data?: Record<string, unknown> } }) => {
        await cacheSyncHandler.process(job);
      }
    );

    console.log('Queue workers set up successfully');

    // Start periodic queue maintenance and expired URL cleanup
    startQueueMaintenance(queueManager);
    startExpiredUrlCleanup(queueManager);

  } catch (error) {
    console.error('Failed to setup queue workers:', error);
    throw error;
  }
}

// Periodic queue maintenance
function startQueueMaintenance(queueManager: QueueManager): void {
  // Clean old jobs every hour
  setInterval(async () => {
    try {
      console.log('Running queue maintenance...');
      await queueManager.cleanQueue('click-processing');
      await queueManager.cleanQueue('short-code-pool');
      await queueManager.cleanQueue('cache-sync');
      await queueManager.cleanQueue('expired-url-cleanup');
      console.log('Queue maintenance completed');
    } catch (error) {
      console.error('Queue maintenance failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Queue health check every 5 minutes
  setInterval(async () => {
    try {
      const healthy = await queueManager.isHealthy();
      if (!healthy) {
        console.warn('Queue health check failed');
      }
    } catch (error) {
      console.error('Queue health check error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Periodic expired URL cleanup
function startExpiredUrlCleanup(queueManager: QueueManager): void {
  // Run expired URL cleanup every 6 hours
  setInterval(async () => {
    try {
      console.log('Scheduling expired URL cleanup job...');
      
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
      
      console.log('Expired URL cleanup job scheduled');
    } catch (error) {
      console.error('Failed to schedule expired URL cleanup job:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Also run cleanup on startup (after 5 minutes to let system stabilize)
  setTimeout(async () => {
    try {
      console.log('Running initial expired URL cleanup...');
      
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
      
      console.log('Initial expired URL cleanup job scheduled');
    } catch (error) {
      console.error('Failed to schedule initial expired URL cleanup job:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 