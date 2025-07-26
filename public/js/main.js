// MiniLink Frontend JavaScript - Enhanced Version

// Global state management
class AppState {
    constructor() {
        this.recentUrls = [];
        this.popularUrls = [];
        this.systemStats = {};
        this.currentPage = this.detectCurrentPage();
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        if (path === '/') return 'home';
        if (path === '/dashboard') return 'dashboard';
        if (path.includes('/stats')) return 'stats';
        return 'other';
    }
}

// Main application class
class MiniLinkApp {
    constructor() {
        this.state = new AppState();
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.loadInitialData();
        this.setupAnimations();
    }

    setupEventListeners() {
        // URL shortening form (new structure)
        const urlForm = document.getElementById('urlForm');
        if (urlForm) {
            urlForm.addEventListener('submit', (e) => this.handleUrlShortening(e));
        }

        // Expiration radio buttons
        const expirationInputs = document.querySelectorAll('input[name="expiration"]');
        expirationInputs.forEach(input => {
            input.addEventListener('change', () => this.handleExpirationChange());
        });

        // URL lookup form (dashboard)
        const urlLookupForm = document.getElementById('urlLookupForm');
        if (urlLookupForm) {
            urlLookupForm.addEventListener('click', (e) => {
                if (e.target.matches('button[type="submit"]')) {
                    e.preventDefault();
                    this.handleUrlLookup();
                }
            });
        }

        // Copy buttons (enhanced)
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-copy]') || e.target.closest('[data-copy]')) {
                e.preventDefault();
                this.handleCopyToClipboard(e);
            }
        });

        // QR code buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-qr]') || e.target.closest('[data-qr]')) {
                e.preventDefault();
                this.handleGenerateQR(e);
            }
        });

        // Refresh buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-refresh]') || e.target.closest('[data-refresh]')) {
                e.preventDefault();
                this.handleRefresh(e);
            }
        });

        // Share buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-share]') || e.target.closest('[data-share]')) {
                e.preventDefault();
                this.handleShare(e);
            }
        });
    }

    loadInitialData() {
        // Load data based on current page
        switch (this.state.currentPage) {
            case 'home':
                this.loadRecentUrls();
                break;
            case 'dashboard':
                this.loadSystemStats();
                this.loadRecentUrls();
                this.loadPopularUrls();
                break;
            case 'stats':
                // Stats page loads its own data
                break;
        }
    }

    setupAnimations() {
        // Intersection Observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, { threshold: 0.1 });

        // Observe elements for animation
        document.querySelectorAll('.card, .stat-item, .url-item').forEach(el => {
            observer.observe(el);
        });
    }

    // Enhanced URL shortening with expiration support
    async handleUrlShortening(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const originalUrl = formData.get('originalUrl');
        const expiration = formData.get('expiration');
        
        // Validate URL
        if (!this.isValidUrl(originalUrl)) {
            this.showError('Please enter a valid URL starting with http:// or https://');
            return;
        }

        // Prepare request data
        const requestData = {
            originalUrl: originalUrl
        };

        // Handle expiration
        if (expiration && expiration !== 'none') {
            if (expiration === 'custom') {
                const customDate = formData.get('customExpirationDate');
                if (!customDate) {
                    this.showError('Please select an expiration date');
                    return;
                }
                requestData.expiresAt = new Date(customDate).toISOString();
            } else {
                const expirationDate = this.calculateExpirationDate(expiration);
                requestData.expiresAt = expirationDate.toISOString();
            }
        }

        this.showLoading();
        this.hideError();

        try {
            const response = await fetch('/api/shorten', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result.data);
                this.loadRecentUrls(); // Refresh recent URLs
            } else {
                throw new Error(result.error?.message || 'Failed to shorten URL');
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    calculateExpirationDate(expiration) {
        const now = new Date();
        switch (expiration) {
            case '1d':
                return new Date(now.getTime() + 24 * 60 * 60 * 1000);
            case '1w':
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            case '1m':
                return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            default:
                return now;
        }
    }

    handleExpirationChange() {
        const selectedValue = document.querySelector('input[name="expiration"]:checked').value;
        const customDateContainer = document.getElementById('customDateContainer');
        const customDateInput = document.getElementById('customExpirationDate');
        
        if (selectedValue === 'custom') {
            customDateContainer.style.display = 'block';
            customDateInput.required = true;
        } else {
            customDateContainer.style.display = 'none';
            customDateInput.required = false;
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    showLoading() {
        const loadingState = document.getElementById('loadingState');
        const successCard = document.getElementById('successCard');
        const errorSection = document.getElementById('errorSection');
        
        if (loadingState) loadingState.style.display = 'block';
        if (successCard) successCard.style.display = 'none';
        if (errorSection) errorSection.style.display = 'none';
    }

    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.style.display = 'none';
    }

    showSuccess(data) {
        const successCard = document.getElementById('successCard');
        if (!successCard) return;

        // Populate success data
        const shortUrlResult = document.getElementById('shortUrlResult');
        const visitUrlBtn = document.getElementById('visitUrlBtn');
        const statsUrlBtn = document.getElementById('statsUrlBtn');
        const createdTime = document.getElementById('createdTime');
        const clickCount = document.getElementById('clickCount');
        const expirationInfo = document.getElementById('expirationInfo');
        const expirationTime = document.getElementById('expirationTime');

        if (shortUrlResult) shortUrlResult.value = data.shortUrl;
        if (visitUrlBtn) visitUrlBtn.href = data.shortUrl;
        if (statsUrlBtn) statsUrlBtn.href = `/${data.shortSlug}/stats`;
        if (createdTime) createdTime.textContent = new Date(data.createdAt).toLocaleString();
        if (clickCount) clickCount.textContent = data.clickCount;

        // Handle expiration display
        if (data.expiresAt && expirationInfo && expirationTime) {
            expirationTime.textContent = new Date(data.expiresAt).toLocaleString();
            expirationInfo.style.display = 'flex';
        } else if (expirationInfo) {
            expirationInfo.style.display = 'none';
        }

        successCard.style.display = 'block';
        successCard.classList.add('animate-in');
        
        this.showToast('URL shortened successfully!', 'success');
    }

    showError(message) {
        const errorSection = document.getElementById('errorSection');
        const errorTitle = document.getElementById('errorTitle');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorTitle) errorTitle.textContent = 'Error';
        if (errorMessage) errorMessage.textContent = message;
        if (errorSection) {
            errorSection.style.display = 'block';
            errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        this.showToast(message, 'error');
    }

    hideError() {
        const errorSection = document.getElementById('errorSection');
        if (errorSection) errorSection.style.display = 'none';
    }

    // Enhanced URL lookup
    async handleUrlLookup() {
        const slugInput = document.getElementById('slugInput');
        if (!slugInput) return;
        
        const slug = slugInput.value.trim();
        if (!slug) {
            this.showUrlLookupError('Please enter a URL slug');
            return;
        }

        this.showUrlLookupLoading();

        try {
            const response = await fetch(`/api/urls/${slug}/stats`);
            const result = await response.json();

            if (response.ok && result.success) {
                this.showUrlDetails(result.data, slug);
            } else if (response.status === 404) {
                this.showUrlNotFound();
            } else {
                throw new Error(result.error?.message || 'Failed to lookup URL');
            }
        } catch (error) {
            this.showUrlLookupError(error.message);
        }
    }

    showUrlDetails(data, slug) {
        const detailsSection = document.getElementById('urlDetailsSection');
        const originalUrlDisplay = document.getElementById('originalUrlDisplay');
        const urlClickCount = document.getElementById('urlClickCount');
        const shortUrlDisplay = document.getElementById('shortUrlDisplay');
        const urlCreatedDate = document.getElementById('urlCreatedDate');
        const visitUrlBtn = document.getElementById('visitUrlBtn');
        const viewStatsBtn = document.getElementById('viewStatsBtn');

        if (detailsSection && originalUrlDisplay) {
            originalUrlDisplay.textContent = data.originalUrl;
            urlClickCount.textContent = data.clickCount;
            shortUrlDisplay.value = `${window.location.origin}/${slug}`;
            urlCreatedDate.textContent = this.formatDate(data.createdAt);
            visitUrlBtn.href = `/${slug}`;
            viewStatsBtn.href = `/${slug}/stats`;

            this.hideUrlLookupMessages();
            detailsSection.style.display = 'block';
            detailsSection.classList.add('fade-in');
            
            this.showToast('URL found successfully!', 'success');
        }
    }

    showUrlLookupLoading() {
        this.hideUrlLookupMessages();
        const container = document.getElementById('urlDetailsSection');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-custom mx-auto"></div>
                    <p class="text-muted mt-3">Looking up URL...</p>
                </div>
            `;
            container.style.display = 'block';
        }
    }

    showUrlNotFound() {
        this.hideUrlLookupMessages();
        const notFoundSection = document.getElementById('urlNotFoundSection');
        if (notFoundSection) {
            notFoundSection.style.display = 'block';
        }
    }

    showUrlLookupError(message) {
        this.hideUrlLookupMessages();
        const errorMessageEl = document.getElementById('urlLookupErrorMessage');
        const errorSection = document.getElementById('urlLookupError');
        
        if (errorMessageEl) errorMessageEl.textContent = message;
        if (errorSection) errorSection.style.display = 'block';
        
        this.showToast(message, 'error');
    }

    hideUrlLookupMessages() {
        const sections = ['urlDetailsSection', 'urlNotFoundSection', 'urlLookupError'];
        sections.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
    }

    // Enhanced copy to clipboard
    async handleCopyToClipboard(event) {
        const element = event.target.closest('[data-copy]') || event.target;
        const textToCopy = element.dataset.copy || element.value || element.textContent;
        
        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            this.showCopySuccess(element);
        } catch (err) {
            this.fallbackCopy(textToCopy);
        }
    }

    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showToast('URL copied to clipboard!', 'success');
    }

    showCopySuccess(element) {
        const originalContent = element.innerHTML;
        element.classList.add('copy-success');
        element.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            element.classList.remove('copy-success');
            element.innerHTML = originalContent;
        }, 2000);
        
        this.showToast('URL copied to clipboard!', 'success');
    }

    // Enhanced QR code generation
    handleGenerateQR(event) {
        const element = event.target.closest('[data-qr]') || event.target;
        const url = element.dataset.qr || element.value || element.textContent;
        
        if (!url) return;

        this.generateQRCode(url);
    }

    generateQRCode(url) {
        const qrCodeDisplay = document.getElementById('qrCodeDisplay');
        if (qrCodeDisplay) {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            qrCodeDisplay.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width: 100%; height: auto;">`;
            
            const qrModal = document.getElementById('qrModal');
            if (qrModal) qrModal.classList.add('show');
        }
    }

    // Enhanced refresh functionality
    handleRefresh(event) {
        const element = event.target.closest('[data-refresh]') || event.target;
        const refreshType = element.dataset.refresh;
        
        switch (refreshType) {
            case 'recent':
                this.loadRecentUrls();
                break;
            case 'popular':
                this.loadPopularUrls();
                break;
            case 'stats':
                this.loadSystemStats();
                break;
            case 'all':
                this.loadSystemStats();
                this.loadRecentUrls();
                this.loadPopularUrls();
                break;
        }
        
        this.showToast('Data refreshed!', 'success');
    }

    // Enhanced share functionality
    async handleShare(event) {
        const element = event.target.closest('[data-share]') || event.target;
        const url = element.dataset.share || element.value || element.textContent;
        
        if (!url) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Check out this link',
                    text: 'Shortened URL created with MiniLink',
                    url: url
                });
            } catch (err) {
                this.handleCopyToClipboard({ target: element });
            }
        } else {
            this.handleCopyToClipboard({ target: element });
        }
    }

    // Data loading functions
    async loadRecentUrls() {
        const container = document.getElementById('recentUrlsContainer');
        if (!container) return;

        try {
            this.showLoadingState(container, 'Loading recent URLs...');
            
            const response = await fetch('/api/urls/recent?limit=5');
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                this.state.recentUrls = result.data;
                this.displayRecentUrls(container, result.data);
            } else {
                this.showEmptyState(container, 'No URLs Yet', 'Create your first short URL above');
            }
        } catch (error) {
            console.error('Failed to load recent URLs:', error);
            this.showErrorState(container, 'Failed to load recent URLs');
        }
    }

    async loadPopularUrls() {
        const container = document.getElementById('popularUrlsContainer');
        if (!container) return;

        try {
            this.showLoadingState(container, 'Loading popular URLs...');
            
            const response = await fetch('/api/urls/popular?limit=5');
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                this.state.popularUrls = result.data;
                this.displayPopularUrls(container, result.data);
            } else {
                this.showEmptyState(container, 'No Popular URLs', 'URLs with clicks will appear here');
            }
        } catch (error) {
            console.error('Failed to load popular URLs:', error);
            this.showErrorState(container, 'Failed to load popular URLs');
        }
    }

    async loadSystemStats() {
        try {
            const response = await fetch('/api/stats');
            const result = await response.json();

            if (result.success) {
                this.state.systemStats = result.data;
                this.displaySystemStats(result.data);
            }
        } catch (error) {
            console.error('Failed to load system stats:', error);
        }
    }

    // Display functions
    displayRecentUrls(container, urls) {
        const urlList = document.createElement('div');
        urlList.className = 'url-list enhanced fade-in';
        
        urls.forEach(url => {
            const urlItem = this.createURLItem(url, 'recent');
            urlList.appendChild(urlItem);
        });
        
        container.innerHTML = '';
        container.appendChild(urlList);
    }

    displayPopularUrls(container, urls) {
        const urlList = document.createElement('div');
        urlList.className = 'url-list enhanced fade-in';
        
        urls.forEach((url, index) => {
            const urlItem = this.createURLItem(url, 'popular', index);
            urlList.appendChild(urlItem);
        });
        
        container.innerHTML = '';
        container.appendChild(urlList);
    }

    createURLItem(url, type, index = 0) {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item enhanced';
        
        const rankBadge = type === 'popular' ? `
            <div class="rank-badge rank-${index + 1}">
                ${index + 1}
            </div>
        ` : '';
        
        urlItem.innerHTML = `
            <div class="url-main">
                ${rankBadge}
                <div class="url-info">
                    <div class="url-slug">/${url.shortSlug}</div>
                    <div class="url-original">${this.truncateUrl(url.originalUrl, 60)}</div>
                    ${url.expiresAt ? `
                        <div class="url-expiration">
                            <i class="fas fa-clock"></i>
                            Expires: ${new Date(url.expiresAt).toLocaleDateString()}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="url-meta">
                <div class="click-info">
                    <span class="click-count">${url.clickCount}</span>
                    <span class="click-label">clicks</span>
                </div>
                ${type === 'recent' ? `
                    <span class="url-time">${this.formatRelativeTime(url.createdAt)}</span>
                ` : ''}
                <a href="/${url.shortSlug}/stats" class="btn btn-sm btn-outline enhanced">
                    <i class="fas fa-chart-line"></i>
                </a>
            </div>
        `;
        
        return urlItem;
    }

    displaySystemStats(stats) {
        const totalUrlsEl = document.getElementById('totalUrls');
        const totalClicksEl = document.getElementById('totalClicks');
        const avgClicksEl = document.getElementById('avgClicksPerUrl');
        const systemUptimeEl = document.getElementById('systemUptime');

        if (totalUrlsEl) totalUrlsEl.textContent = this.formatNumber(stats.totalUrls);
        if (totalClicksEl) totalClicksEl.textContent = this.formatNumber(stats.totalClicks);
        if (avgClicksEl) {
            const avgClicks = stats.totalUrls > 0 ? (stats.totalClicks / stats.totalUrls).toFixed(1) : '0';
            avgClicksEl.textContent = avgClicks;
        }
        if (systemUptimeEl) {
            // Mock uptime for now
            const uptimeHours = Math.floor(Math.random() * 720) + 24;
            const uptimeDays = Math.floor(uptimeHours / 24);
            systemUptimeEl.textContent = `${uptimeDays}d ${uptimeHours % 24}h`;
        }
    }

    // Utility functions
    showLoadingState(container, message = 'Loading...') {
        container.innerHTML = `
            <div class="loading-placeholder">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
    }

    showEmptyState(container, title, message) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-link"></i>
                </div>
                <h4 class="empty-title">${title}</h4>
                <p class="empty-subtitle">${message}</p>
            </div>
        `;
    }

    showErrorState(container, message) {
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h4 class="error-title">Error</h4>
                <p class="error-subtitle">${message}</p>
            </div>
        `;
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        const container = document.querySelector('.toast-container') || this.createToastContainer();
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    truncateUrl(url, maxLength) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }
}

// Global functions for compatibility with existing code
function copyToClipboard(text) {
    if (window.miniLinkApp) {
        const event = { target: { dataset: { copy: text } } };
        window.miniLinkApp.handleCopyToClipboard(event);
    }
}

function generateQRCode(url) {
    if (window.miniLinkApp) {
        const event = { target: { dataset: { qr: url } } };
        window.miniLinkApp.handleGenerateQR(event);
    }
}

function closeQRModal() {
    const qrModal = document.getElementById('qrModal');
    if (qrModal) qrModal.classList.remove('show');
}

function downloadQRCode() {
    const shortUrl = document.getElementById('shortUrlResult')?.value || 
                    document.getElementById('shortUrlDisplay')?.value;
    if (shortUrl) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shortUrl)}`;
        const link = document.createElement('a');
        link.download = 'qr-code.png';
        link.href = qrUrl;
        link.click();
        if (window.miniLinkApp) {
            window.miniLinkApp.showToast('QR Code downloaded!', 'success');
        }
    }
}

function refreshStats() {
    location.reload();
}

function shareUrl() {
    const url = document.getElementById('shortUrlResult')?.value || 
                document.getElementById('shortUrlDisplay')?.value;
    if (url && window.miniLinkApp) {
        const event = { target: { dataset: { share: url } } };
        window.miniLinkApp.handleShare(event);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.miniLinkApp = new MiniLinkApp();
    
    // Make functions globally available for compatibility
    window.copyToClipboard = copyToClipboard;
    window.generateQRCode = generateQRCode;
    window.closeQRModal = closeQRModal;
    window.downloadQRCode = downloadQRCode;
    window.refreshStats = refreshStats;
    window.shareUrl = shareUrl;
}); 