# MiniLink - URL Shortener

A modern, full-stack URL shortening service built with Node.js, Express.js, TypeScript, and PostgreSQL. Features a clean hexagonal architecture, beautiful responsive frontend, and comprehensive analytics.

## 🚀 Features

### Core Functionality
- ⚡ **Lightning Fast URL Shortening** - Generate short URLs in milliseconds
- 🔗 **Reliable Redirection** - High-performance URL redirection service
- 📊 **Click Analytics** - Track clicks and view detailed statistics
- 🎨 **Modern UI** - Beautiful, responsive frontend with premium design
- 📱 **Mobile Optimized** - Perfect experience on all devices

### Advanced Features
- 🏗️ **Hexagonal Architecture** - Clean, maintainable codebase
- 🛡️ **Security First** - Input validation, rate limiting, SQL injection protection
- 🔍 **Analytics Dashboard** - System-wide statistics and insights
- 📋 **Copy to Clipboard** - One-click URL copying
- 🎯 **Error Handling** - Comprehensive error management and user feedback
- 🏥 **Health Monitoring** - Built-in health checks and graceful shutdown

## 🛠️ Technology Stack

### Backend
- **Node.js** with **Express.js** - Fast, scalable server
- **TypeScript** - Type-safe JavaScript with enhanced developer experience
- **PostgreSQL** - Robust relational database with ACID compliance
- **NanoID** - Cryptographically secure unique ID generation

### Frontend
- **EJS** - Server-side templating with dynamic content
- **Bootstrap 5** - Modern, responsive CSS framework
- **Font Awesome** - Beautiful icon library
- **Vanilla JavaScript** - Progressive enhancement and interactivity

### Architecture
- **Hexagonal/Clean Architecture** - Separation of concerns
- **Repository Pattern** - Database abstraction layer
- **Dependency Injection** - Loose coupling and testability
- **Domain-Driven Design** - Rich domain models with business logic

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **PostgreSQL** (v12 or higher) - [Download here](https://postgresql.org/)
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

### 3. Database Setup

#### Option A: Using Connection String
Create a `.env.development` file in the project root:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/minilink_db

# Application Configuration
PORT=3000
NODE_ENV=development

# NanoID Configuration
NANOID_LENGTH=7
NANOID_ALPHABET=ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789
```

#### Option B: Individual Database Components
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=minilink_db
DB_USER=your_username
DB_PASSWORD=your_password

# Application Configuration
PORT=3000
NODE_ENV=development

# NanoID Configuration
NANOID_LENGTH=7
NANOID_ALPHABET=ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789
```

### 4. Create Database

Connect to PostgreSQL and create the database:

```sql
CREATE DATABASE minilink_db;
```

*Note: The application will automatically create tables, indexes, and triggers on first run.*

### 5. Build the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### 6. Access the Application

- **Web Interface**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Endpoints**: http://localhost:3000/api/*

## 📖 Usage

### Web Interface

1. **Home Page** (`/`): Enter a long URL and click "Shorten URL"
2. **Dashboard** (`/dashboard`): View system analytics and statistics
3. **URL Stats** (`/:slug/stats`): View detailed statistics for a specific URL

### API Endpoints

#### Shorten URL
```bash
POST /api/shorten
Content-Type: application/json

{
  "originalUrl": "https://example.com/very-long-url"
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
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Redirect to Original URL
```bash
GET /:slug
# Automatically redirects to original URL and increments click count
```

#### Get URL Statistics
```bash
GET /:slug/stats
# Returns JSON with URL statistics
```

#### System Statistics
```bash
GET /api/stats
# Returns system-wide analytics
```

## 🏗️ Project Structure

```
minilink/
├── src/
│   ├── config/          # Configuration and database setup
│   ├── controllers/     # Request handlers (API & Views)
│   ├── middleware/      # Express middleware (logging, errors, etc.)
│   ├── models/          # Domain models with business logic
│   ├── repositories/    # Data access layer
│   ├── routes/          # Route definitions and setup
│   ├── services/        # Business logic layer
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── views/           # EJS templates
│   └── index.ts         # Application entry point
├── public/              # Static assets (CSS, JS, images)
├── dist/                # Compiled JavaScript (production)
├── tests/               # Test files (future)
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

# Linting (if configured)
npm run lint
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
- **Services**: URL shortening, redirection, analytics
- **Utilities**: Slug generation, collision handling
- **Repositories**: Database operations, query optimization
- **Controllers**: API endpoints, request/response handling
- **Middleware**: Error handling, logging, security

#### Writing Tests

Tests use Jest with TypeScript support and include:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **Mocking**: External dependencies are properly mocked
- **Test Data**: Fixtures provide consistent test scenarios
- **Database Tests**: Use test database for integration testing

Example test file structure:
```typescript
describe('UrlService', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  describe('shortenUrl', () => {
    it('should create a short URL successfully', async () => {
      // Test implementation
    });
  });
});
```

### Database Schema

The application automatically creates the following schema:

```sql
CREATE TABLE urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_url TEXT NOT NULL,
    short_slug VARCHAR(20) NOT NULL UNIQUE,
    click_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NULL -- For future authentication features
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_urls_short_slug ON urls(short_slug);
CREATE INDEX idx_urls_original_url ON urls(original_url);
CREATE INDEX idx_urls_created_at ON urls(created_at DESC);
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Full PostgreSQL connection string | - |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | - |
| `DB_USER` | Database username | - |
| `DB_PASSWORD` | Database password | - |
| `NANOID_LENGTH` | Short URL length | `7` |
| `NANOID_ALPHABET` | Characters for URL generation | Custom safe alphabet |

### Rate Limiting

- **URL Shortening**: 10 requests per minute
- **General API**: 100 requests per minute
- **Redirects**: No limit (performance optimized)

## 🛡️ Security Features

- **Input Validation**: Comprehensive URL and slug validation
- **SQL Injection Prevention**: Parameterized queries
- **Rate Limiting**: Protection against abuse
- **Security Headers**: XSS, CSRF, and other protections
- **CORS Configuration**: Proper cross-origin handling
- **Error Handling**: Secure error responses without sensitive data

## 📈 Performance Features

- **Connection Pooling**: Efficient database connections (max 20)
- **Async Operations**: Non-blocking click count updates
- **Optimized Queries**: Indexed database lookups
- **Static Asset Serving**: Efficient CSS/JS delivery
- **Graceful Shutdown**: Proper resource cleanup

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set secure database credentials
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up automated backups

### Docker Support (Future)

```dockerfile
# Example Dockerfile (not included yet)
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY dist ./dist
COPY public ./public
EXPOSE 3000
CMD ["npm", "start"]
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

### Medium Term
- [ ] Advanced analytics (geographic, referrer data)
- [ ] Team collaboration features
- [ ] Custom domains
- [ ] API rate limiting per user

### Long Term
- [ ] Mobile applications
- [ ] Enterprise SSO integration
- [ ] Advanced reporting and compliance
- [ ] AI-powered URL categorization

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/minilink/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

---

**Built with ❤️ using modern web technologies and clean architecture principles.**

