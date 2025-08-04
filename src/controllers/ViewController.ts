import { Request, Response } from 'express';
import { UrlService } from '../services/UrlService';
import { serverConfig } from '../config';
import { logger } from '../middleware/logger';
import * as ejs from 'ejs';
import * as path from 'path';

export class ViewController {
  private urlService: UrlService;

  constructor(urlService: UrlService) {
    this.urlService = urlService;
  }

  // Render home page
  async renderHome(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Rendering home page', { ip: req.ip, userAgent: req.get('User-Agent') });

      res.render('layout', {
        title: 'Home',
        currentPage: 'home',
        body: await renderTemplate('index', {
          baseUrl: serverConfig.baseUrl
        })
      });
    } catch (error) {
      logger.error('Failed to render home page', error as Error);
      throw error;
    }
  }

  // Render dashboard page
  async renderDashboard(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Rendering dashboard page', { ip: req.ip, userAgent: req.get('User-Agent') });

      res.render('layout', {
        title: 'Dashboard',
        currentPage: 'stats',
        body: await renderTemplate('dashboard', {
          baseUrl: serverConfig.baseUrl
        })
      });
    } catch (error) {
      logger.error('Failed to render dashboard page', error as Error);
      throw error;
    }
  }

  // Render URL stats page
  async renderUrlStats(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug;
      
      logger.info('Rendering URL stats page', { slug, ip: req.ip });
      
      if (!slug) {
        logger.warn('URL stats requested without slug');
        res.status(404).render('layout', {
          title: 'Not Found',
          currentPage: '',
          body: await renderTemplate('error', {
            title: 'URL Not Found',
            message: 'The requested URL was not found.',
            statusCode: 404
          })
        });
        return;
      }

      // Get URL stats
      const urlStats = await this.urlService.getUrlStats(slug);
      
      if (!urlStats) {
        logger.warn('URL stats not found', { slug });
        res.status(404).render('layout', {
          title: 'Not Found',
          currentPage: '',
          body: await renderTemplate('error', {
            title: 'URL Not Found',
            message: `Short URL '${slug}' was not found.`,
            statusCode: 404,
            backLink: '/',
            backLinkText: 'Go Home'
          })
        });
        return;
      }

      // Ensure dates are properly formatted for the template
      const formattedUrlStats = {
        ...urlStats,
        createdAt: urlStats.createdAt instanceof Date ? urlStats.createdAt.toISOString() : urlStats.createdAt,
        updatedAt: urlStats.updatedAt instanceof Date ? urlStats.updatedAt.toISOString() : urlStats.updatedAt,
        expiresAt: urlStats.expiresAt instanceof Date ? urlStats.expiresAt.toISOString() : urlStats.expiresAt
      };

      logger.info('URL stats page rendered successfully', { slug });

      res.render('layout', {
        title: `Stats for ${slug}`,
        currentPage: 'stats',
        body: await renderTemplate('url-stats', {
          urlStats: formattedUrlStats,
          slug,
          shortUrl: `${serverConfig.baseUrl}/${slug}`,
          baseUrl: serverConfig.baseUrl
        })
      });
    } catch (error) {
      logger.error('Failed to render URL stats page', error as Error, { slug: req.params.slug });
      throw error;
    }
  }

  // Handle 404 for frontend routes
  async render404(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Rendering 404 page', { 
        path: req.path, 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });

      res.status(404).render('layout', {
        title: 'Page Not Found',
        currentPage: '',
        body: await renderTemplate('error', {
          title: '404 - Page Not Found',
          message: 'The page you are looking for does not exist.',
          statusCode: 404,
          backLink: '/',
          backLinkText: 'Go Home'
        })
      });
    } catch (error) {
      logger.error('Failed to render 404 page', error as Error);
      throw error;
    }
  }

  // Bind methods to ensure proper `this` context
  bindMethods(): ViewController {
    this.renderHome = this.renderHome.bind(this);
    this.renderDashboard = this.renderDashboard.bind(this);
    this.renderUrlStats = this.renderUrlStats.bind(this);
    this.render404 = this.render404.bind(this);
    
    return this;
  }
}

// Helper function to render partial templates
async function renderTemplate(template: string, data: Record<string, unknown> = {}): Promise<string> {
  try {
    // Sanitize any user-provided data to prevent SSTI
    const sanitizedData = sanitizeTemplateData(data);
    
    const templatePath = path.join(__dirname, '../views', `${template}.ejs`);
    return await ejs.renderFile(templatePath, sanitizedData);
  } catch (error) {
    logger.error(`Error rendering template ${template}`, error as Error, { template, dataKeys: Object.keys(data) });
    
    // Fallback error template
    return `
      <div class="container py-5">
        <div class="row justify-content-center">
          <div class="col-lg-6 text-center">
            <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
            <h3>Template Error</h3>
            <p class="text-muted">There was an error rendering the page template.</p>
            <a href="/" class="btn btn-primary">Go Home</a>
          </div>
        </div>
      </div>
    `;
  }
}

// Sanitize template data to prevent Server-Side Template Injection (SSTI)
function sanitizeTemplateData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Remove any potential script tags or dangerous HTML
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (value instanceof Date) {
      // Convert Date objects to ISO strings for template rendering
      sanitized[key] = value.toISOString();
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeTemplateData(value as Record<string, unknown>);
    } else {
      // Pass through other types (numbers, booleans, etc.)
      sanitized[key] = value;
    }
  }
  
  return sanitized;
} 