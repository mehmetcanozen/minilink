import { Request, Response, NextFunction } from 'express';
import { UrlService } from '../services/UrlService';
import { serverConfig } from '../config';

export class ViewController {
  private urlService: UrlService;

  constructor(urlService: UrlService) {
    this.urlService = urlService;
  }

  // Render home page
  async renderHome(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.render('layout', {
        title: 'Home',
        currentPage: 'home',
        body: await renderTemplate('index', {
          baseUrl: serverConfig.baseUrl
        })
      });
    } catch (error) {
      next(error);
    }
  }

  // Render dashboard page
  async renderDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.render('layout', {
        title: 'Dashboard',
        currentPage: 'stats',
        body: await renderTemplate('dashboard', {
          baseUrl: serverConfig.baseUrl
        })
      });
    } catch (error) {
      next(error);
    }
  }

  // Render URL stats page
  async renderUrlStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = req.params.slug;
      
      if (!slug) {
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

      res.render('layout', {
        title: `Stats for ${slug}`,
        currentPage: 'stats',
        body: await renderTemplate('url-stats', {
          urlStats,
          slug,
          shortUrl: `${serverConfig.baseUrl}/${slug}`,
          baseUrl: serverConfig.baseUrl
        })
      });
    } catch (error) {
      next(error);
    }
  }

  // Handle 404 for frontend routes
  async render404(req: Request, res: Response): Promise<void> {
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
  const ejs = await import('ejs');
  const path = await import('path');
  
  try {
    const templatePath = path.join(__dirname, '../views', `${template}.ejs`);
    return await ejs.renderFile(templatePath, data);
  } catch (error) {
    console.error(`Error rendering template ${template}:`, error);
    
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