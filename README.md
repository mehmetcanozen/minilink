# MiniLink - URL Shortener

A modern, full-stack URL shortening service built with Node.js, Express.js, TypeScript, PostgreSQL, Redis, and BullMQ. Features a clean hexagonal architecture, beautiful responsive dark-themed frontend, comprehensive analytics, URL expiration, and real-time performance optimization.

## 🚀 Features

### Core Functionality
- ⚡ **Lightning Fast URL Shortening** - Generate short URLs in milliseconds
- 🔗 **Reliable Redirection** - High-performance URL redirection service
- 📊 **Real-Time Analytics** - Track clicks with Redis-powered real-time counting
- 🎨 **Modern Dark UI** - Beautiful, responsive dark-themed frontend
- 📱 **Mobile Optimized** - Perfect experience on all devices
- ⏰ **URL Expiration** - Set custom expiration dates for your links
- 🔄 **Auto Cleanup** - Automatic removal of expired URLs

### Advanced Features
- 🏗️ **Hexagonal Architecture** - Clean, maintainable codebase with dependency injection
- 🛡️ **Security First** - Input validation with Zod, rate limiting, SQL injection protection
- 🔍 **Analytics Dashboard** - System-wide statistics and insights
- 📋 **Copy to Clipboard** - One-click URL copying
- 🎯 **Error Handling** - Comprehensive error management with structured logging
- 🏥 **Health Monitoring** - Built-in health checks and graceful shutdown
- 🚀 **Performance Optimized** - Redis caching and BullMQ job queues
- 🔧 **Short Code Pooling** - Pre-generated slugs for faster creation
- 🔐 **Authentication Ready** - Framework for future JWT/OAuth integration
- 📝 **Structured Logging** - Comprehensive logging with context and levels
- 🎨 **Modern UI/UX** - Glassmorphism effects, smooth animations, dark theme

## 🛠️ Technology Stack

### Backend
- **Node.js** with **Express.js** - Fast, scalable server
- **TypeScript** - Type-safe JavaScript with enhanced developer experience
- **PostgreSQL** - Robust relational database with ACID compliance
- **Prisma** - Modern ORM with type safety and migrations
- **Redis** - High-performance caching and real-time data
- **BullMQ** - Reliable job queue system for scalability
- **NanoID** - Cryptographically secure unique ID generation
- **Helmet** - Security headers and protection
- **Zod** - TypeScript-first schema validation
- **Express Rate Limit** - Advanced rate limiting with multiple tiers

### Frontend
- **EJS** - Server-side templating with dynamic content
- **Bootstrap 5** - Modern, responsive CSS framework
- **Font Awesome** - Beautiful icon library
- **Vanilla JavaScript** - Progressive enhancement and interactivity

### Architecture
- **Hexagonal/Clean Architecture** - Separation of concerns with dependency injection
- **Repository Pattern** - Database abstraction layer with multiple implementations
- **Dependency Injection** - Loose coupling and testability
- **Domain-Driven Design** - Rich domain models with business logic
- **Queue Pattern** - Asynchronous job processing with BullMQ
- **Cache Pattern** - Multi-layer caching strategy with Redis
- **Middleware Pattern** - Request processing pipeline with security

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **PostgreSQL** (v12 or higher) - [Download here](https://postgresql.org/)
- **Redis** (v6 or higher) - [Download here](https://redis.io/)
- **Git** - [Download here](https://git-scm.com/)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/minilink.git
cd minilink
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.development` file in the project root:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/minilink_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Application Configuration
PORT=3000
NODE_ENV=development

# NanoID Configuration
NANOID_SIZE=7
NANOID_ALPHABET=ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789

# Database Provider (prisma or pg)
DB_PROVIDER=prisma

# Queue Configuration
QUEUE_MAINTENANCE_INTERVAL_MS=300000
QUEUE_HEALTH_CHECK_INTERVAL_MS=60000
EXPIRED_URL_CLEANUP_INTERVAL_MS=3600000
INITIAL_CLEANUP_DELAY_MS=60000
```

### 4. Database Setup

Connect to PostgreSQL and create the database:

```sql
CREATE DATABASE minilink_db;
```

### 5. Redis Setup

Ensure Redis server is running:

```bash
# On Windows (if using WSL or Redis for Windows)
redis-server

# On macOS (if using Homebrew)
brew services start redis

# On Linux
sudo systemctl start redis
```

### 6. Database Migrations

Run Prisma migrations to set up the database schema:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed the database with sample data
npx prisma db seed
```

### 7. Build and Start

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### 8. Access the Application

- **Web Interface**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **API Endpoints**: http://localhost:3000/api/*
- **Queue Status**: http://localhost:3000/api/queues/status
- **Pool Status**: http://localhost:3000/api/pool/status

## 📖 Usage

### Web Interface

1. **Home Page** (`/`): Enter a long URL, set expiration (optional), and click "Shorten URL"
2. **Dashboard** (`/dashboard`): View system analytics and real-time statistics
3. **URL Stats** (`/:slug/stats`): View detailed statistics for a specific URL

### API Endpoints

#### Shorten URL
```bash
POST /api/shorten
Content-Type: application/json

{
  "originalUrl": "https://example.com/very-long-url",
  "expiresAt": "2024-12-31T23:59:59.000Z"  // Optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "shortUrl": "http://localhost:3000/abc123",
    "shortSlug": "abc123",
    "originalUrl": "https://example.com/very-long-url",
    "clickCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "expiresAt": "2024-12-31T23:59:59.000Z"
  }
}
```

#### Redirect to Original URL
```bash
GET /:slug
# Automatically redirects to original URL and increments click count
# Returns 410 Gone if URL has expired
```

#### Get URL Statistics
```bash
GET /:slug/stats
# Returns JSON with URL statistics including expiration info
```

#### System Statistics
```bash
GET /api/stats
# Returns system-wide analytics with real-time data
```

#### Queue Health
```bash
GET /api/queues/status
# Returns status of all BullMQ queues and workers
```

#### Pool Status
```bash
GET /api/pool/status
# Returns short code pool statistics
```

## 🏗️ Project Structure

```
minilink/
├── src/
│   ├── config/          # Configuration and external services setup
│   │   ├── database.ts  # PostgreSQL configuration
│   │   ├── redis.ts     # Redis configuration and cache service
│   │   ├── prisma.ts    # Prisma ORM setup
│   │   └── index.ts     # Centralized configuration management
│   ├── controllers/     # Request handlers (API & Views)
│   │   ├── UrlController.ts    # API endpoints
│   │   ├── ViewController.ts   # Page rendering
│   │   └── HealthController.ts # Health monitoring
│   ├── middleware/      # Express middleware
│   │   ├── logger.ts    # Structured logging and request processing
│   │   ├── errorHandler.ts # Global error handling
│   │   ├── security.ts  # Security headers and protection
│   │   ├── auth.ts      # Authentication framework (placeholder)
│   │   └── rateLimiting.ts # Advanced rate limiting
│   ├── models/          # Domain models with business logic
│   ├── repositories/    # Data access layer
│   │   ├── PrismaUrlRepository.ts # Prisma-based implementation
│   │   └── UrlRepository.ts       # Raw PostgreSQL implementation
│   ├── routes/          # Route definitions and setup
│   │   ├── api.ts       # API routes with authentication
│   │   ├── web.ts       # Public web routes
│   │   └── index.ts     # Route orchestration
│   ├── services/        # Business logic layer
│   │   ├── UrlService.ts    # Core business logic
│   │   └── CacheService.ts  # Redis caching operations
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── views/           # EJS templates
│   ├── queues/          # BullMQ job queues and handlers
│   │   ├── QueueManager.ts
│   │   └── handlers/    # Job processing handlers
│   ├── schemas/         # Zod validation schemas
│   └── index.ts         # Application entry point
├── public/              # Static assets (CSS, JS, images)
├── prisma/              # Prisma schema and migrations
├── dist/                # Compiled JavaScript (production)
├── tests/               # Test files
├── .env.development     # Environment variables
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## 🧪 Development

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm test
npm run test:watch
npm run test:coverage

# Database operations
npm run db:migrate
npm run db:seed
npm run db:reset
```

### Testing

The project includes a comprehensive test suite with unit, integration, and end-to-end tests.

#### Test Structure
```
tests/
├── unit/                 # Unit tests for individual components
│   ├── models/          # Domain model tests
│   ├── services/        # Business logic tests
│   ├── utils/           # Utility function tests
│   └── middleware/      # Middleware tests
├── integration/         # Integration tests
│   ├── api/            # API endpoint tests
│   └── database/       # Database integration tests
├── e2e/                # End-to-end tests
├── fixtures/           # Test data and mocks
└── helpers/            # Test utilities and setup
```

#### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only end-to-end tests
npm run test:e2e
```

#### Test Coverage

The project maintains high test coverage across all layers:

- **Models**: Domain validation, business logic, factory methods
- **Services**: URL shortening, redirection, analytics, caching
- **Utilities**: Slug generation, collision handling
- **Repositories**: Database operations, query optimization
- **Controllers**: API endpoints, request/response handling
- **Middleware**: Error handling, logging, security
- **Queue Handlers**: Job processing, error scenarios

### Database Schema

The application uses Prisma ORM with the following schema:

```prisma
model Url {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  originalUrl String    @map("original_url") @db.Text
  shortSlug   String    @unique @map("short_slug") @db.VarChar(20)
  clickCount  Int       @default(0) @map("click_count")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  expiresAt   DateTime? @map("expires_at") @db.Timestamptz
  userId      String?   @map("user_id") @db.Uuid

  @@index([shortSlug], name: "idx_urls_short_slug")
  @@index([originalUrl], name: "idx_urls_original_url")
  @@index([createdAt], name: "idx_urls_created_at")
  @@index([expiresAt], name: "idx_urls_expires_at")
  @@index([userId], name: "idx_urls_user_id")
  @@map("urls")
}
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Full PostgreSQL connection string | - |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `REDIS_DB` | Redis database number | `0` |
| `NANOID_SIZE` | Short URL length | `7` |
| `NANOID_ALPHABET` | Characters for URL generation | Custom safe alphabet |
| `DB_PROVIDER` | Database provider | `prisma` |
| `QUEUE_MAINTENANCE_INTERVAL_MS` | Queue maintenance interval | `300000` |
| `QUEUE_HEALTH_CHECK_INTERVAL_MS` | Health check interval | `60000` |
| `EXPIRED_URL_CLEANUP_INTERVAL_MS` | Cleanup interval | `3600000` |

### Rate Limiting

- **URL Shortening**: 10 requests per minute
- **General API**: 100 requests per minute
- **Admin Operations**: 5 requests per minute
- **Redirects**: No limit (performance optimized)
- **Health Checks**: 30 requests per minute

### Redis Configuration

- **Caching**: URL data, click counts, short code pool
- **TTL**: Configurable cache expiration
- **Connection Pooling**: Efficient Redis client management
- **Health Monitoring**: Automatic health checks

### BullMQ Queues

- **Click Processing**: Asynchronous click count updates
- **Short Code Pool**: Pre-generated slug management
- **Cache Sync**: Database-cache synchronization
- **Expired URL Cleanup**: Automatic cleanup of expired URLs
- **Cache Warm-up**: Pre-loading popular URLs into cache

## 🛡️ Security Features

- **Input Validation**: Comprehensive URL and slug validation with Zod
- **SQL Injection Prevention**: Parameterized queries via Prisma
- **Rate Limiting**: Multi-tier protection against abuse
- **Security Headers**: XSS, CSRF, and other protections via Helmet
- **CORS Configuration**: Proper cross-origin handling
- **Error Handling**: Secure error responses without sensitive data
- **Redis Security**: Configurable authentication and network security
- **Authentication Framework**: Ready for JWT/OAuth integration
- **SSTI Protection**: Server-side template injection prevention

## 📈 Performance Features

- **Connection Pooling**: Efficient database and Redis connections
- **Async Operations**: Non-blocking click count updates via queues
- **Caching Strategy**: Multi-layer caching with Redis
- **Static Asset Serving**: Efficient CSS/JS delivery
- **Graceful Shutdown**: Proper resource cleanup
- **Job Queues**: Asynchronous processing for better performance
- **Short Code Pooling**: Pre-generated slugs for faster creation
- **Bulk Operations**: Optimized database operations for multiple URLs

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set secure database credentials
- [ ] Configure Redis server with authentication
- [ ] Set up reverse proxy (nginx/Apache)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up automated backups
- [ ] Configure BullMQ workers
- [ ] Set up health monitoring

### Docker Support (Future)

```dockerfile
# Example Dockerfile (not included yet)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY dist ./dist
COPY public ./public
COPY prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Configurations

#### Development
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/minilink_dev
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Production
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/minilink_prod
REDIS_HOST=prod-redis
REDIS_PORT=6379
REDIS_PASSWORD=secure_password
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔮 Roadmap

### Short Term
- [ ] User authentication and personal dashboards
- [ ] Custom slug support
- [ ] QR code generation
- [ ] Bulk URL operations
- [ ] Advanced analytics (geographic, referrer data)

### Medium Term
- [ ] Team collaboration features
- [ ] Custom domains
- [ ] API rate limiting per user
- [ ] Webhook notifications
- [ ] Advanced reporting and compliance

### Long Term
- [ ] Mobile applications
- [ ] Enterprise SSO integration
- [ ] AI-powered URL categorization
- [ ] Multi-region deployment
- [ ] Advanced caching strategies

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/minilink/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## 🔍 Troubleshooting

### Common Issues

#### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG
```

#### Database Connection Issues
```bash
# Check PostgreSQL connection
psql -h localhost -U username -d minilink_db

# Run Prisma migrations
npx prisma migrate dev
```

#### Queue Worker Issues
```bash
# Check queue status
curl http://localhost:3000/api/queues/status

# Restart workers
npm run dev
```

### Performance Monitoring

- **Health Checks**: `/api/health` endpoint
- **Queue Status**: `/api/queues/status`
- **Pool Status**: `/api/pool/status`
- **System Stats**: `/api/stats`

---

**Built with ❤️ using modern web technologies, clean architecture principles, and advanced features including Redis caching, job queues, URL expiration, structured logging, Zod validation, and comprehensive error handling.**

