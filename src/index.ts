import express from 'express';
import path from 'path';
import { config, validateConfig } from './config';
import { connectDatabase, initializeDatabase, testDatabaseConnection } from './config/database';
import routes from './routes';
import { 
  requestLogger, 
  securityHeaders, 
  corsHeaders, 
  jsonParser, 
  requestSizeLimit 
} from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

// Create Express application
const app = express();

// ============================================================================
// View Engine Configuration
// ============================================================================

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================================================
// Static Files
// ============================================================================

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================================
// Global Middleware (applied to all routes)
// ============================================================================

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security headers
app.use(securityHeaders);

// CORS headers
app.use(corsHeaders);

// Request logging
app.use(requestLogger);

// Request size limiting
app.use(requestSizeLimit('10mb'));

// JSON parsing with error handling
app.use(jsonParser);

// ============================================================================
// Routes
// ============================================================================

// Mount all routes
app.use('/', routes);

// ============================================================================
// Error Handling Middleware (must be last)
// ============================================================================

// Handle 404 (route not found)
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// Server Initialization
// ============================================================================

async function startServer(): Promise<void> {
  try {
    console.log('🚀 Starting MiniLink URL Shortener...');
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🔧 Configuration loaded successfully`);

    // Test database connection
    console.log('🔍 Testing database connection...');
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Initialize database schema
    console.log('📋 Initializing database schema...');
    await initializeDatabase();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`🌐 Server running on port ${config.port}`);
      console.log(`📍 Base URL: ${config.baseUrl}`);
      console.log(`🏥 Health check: ${config.baseUrl}/health`);
      console.log(`📚 API info: ${config.baseUrl}/`);
      console.log('✅ MiniLink URL Shortener is ready!');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('📴 HTTP server closed');
        
        try {
          // Close database connections
          const { disconnectDatabase } = await import('./config/database');
          await disconnectDatabase();
          console.log('🔌 Database connections closed');
        } catch (error) {
          console.error('❌ Error closing database connections:', error);
        }
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown if graceful shutdown takes too long
      setTimeout(() => {
        console.log('⏰ Forcing shutdown due to timeout');
        process.exit(1);
      }, 10000); // 10 seconds timeout
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// Application Health Monitoring
// ============================================================================

// Monitor process health
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const memoryInMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024),
  };

  console.log(`📊 Process health - Uptime: ${Math.round(process.uptime())}s, Memory: ${JSON.stringify(memoryInMB)}MB`);
}, 300000); // Every 5 minutes

// ============================================================================
// Start the application
// ============================================================================

if (require.main === module) {
  // Only start the server if this file is run directly (not imported)
  startServer().catch((error) => {
    console.error('💥 Fatal error during startup:', error);
    process.exit(1);
  });
}

// Export app for testing purposes
export default app; 