// MiniLink Frontend JavaScript

// Global variables
let recentUrls = [];
let popularUrls = [];
let systemStats = {};

// DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize the application
function initializeApp() {
    setupEventListeners();
    loadInitialData();
    setupFormValidation();
}

// Setup event listeners
function setupEventListeners() {
    // URL shortening form
    const shortenForm = document.getElementById('shortenForm');
    if (shortenForm) {
        shortenForm.addEventListener('submit', handleShortenUrl);
    }

    // URL lookup form (dashboard)
    const urlLookupForm = document.getElementById('urlLookupForm');
    if (urlLookupForm) {
        urlLookupForm.addEventListener('submit', handleUrlLookup);
    }

    // Copy buttons
    document.addEventListener('click', function(e) {
        if (e.target.id === 'copyBtn' || e.target.closest('#copyBtn')) {
            handleCopyUrl();
        }
        if (e.target.id === 'copyUrlBtn' || e.target.closest('#copyUrlBtn')) {
            handleCopyUrlFromStats();
        }
    });

    // QR code buttons
    document.addEventListener('click', function(e) {
        if (e.target.id === 'qrBtn' || e.target.closest('#qrBtn')) {
            handleGenerateQR();
        }
        if (e.target.id === 'qrCodeBtn' || e.target.closest('#qrCodeBtn')) {
            handleGenerateQRFromStats();
        }
    });

    // Refresh buttons
    const refreshRecentBtn = document.getElementById('refreshRecentBtn');
    if (refreshRecentBtn) {
        refreshRecentBtn.addEventListener('click', loadRecentUrls);
    }

    const refreshPopularBtn = document.getElementById('refreshPopularBtn');
    if (refreshPopularBtn) {
        refreshPopularBtn.addEventListener('click', loadPopularUrls);
    }
}

// Load initial data
function loadInitialData() {
    if (document.getElementById('recentUrlsContainer')) {
        loadRecentUrls();
    }
    if (document.getElementById('popularUrlsContainer')) {
        loadPopularUrls();
    }
    if (document.getElementById('systemStatsContainer')) {
        loadSystemStats();
    }
}

// Setup form validation
function setupFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
}

// Handle URL shortening
async function handleShortenUrl(event) {
    event.preventDefault();
    
    const form = event.target;
    const originalUrl = form.originalUrl.value.trim();
    const submitBtn = document.getElementById('shortenBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    
    if (!originalUrl) {
        showError('Please enter a valid URL');
        return;
    }

    // Update button state
    submitBtn.disabled = true;
    btnText.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Shortening...';

    try {
        const response = await fetch('/api/shorten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ originalUrl })
        });

        const data = await response.json();

        if (data.success) {
            displayShortenedUrl(data.data);
            form.reset();
            form.classList.remove('was-validated');
            hideError();
            loadRecentUrls(); // Refresh recent URLs
        } else {
            showError(data.error.message || 'Failed to shorten URL');
        }
    } catch (error) {
        console.error('Error shortening URL:', error);
        showError('Network error. Please try again.');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.innerHTML = '<i class="fas fa-magic me-2"></i>Shorten URL';
    }
}

// Display shortened URL result
function displayShortenedUrl(urlData) {
    const resultSection = document.getElementById('resultSection');
    const shortUrlInput = document.getElementById('shortUrl');
    const clickCountSpan = document.getElementById('clickCount');
    const createdDateSpan = document.getElementById('createdDate');
    const visitLink = document.getElementById('visitLink');
    const statsLink = document.getElementById('statsLink');

    if (resultSection && shortUrlInput) {
        shortUrlInput.value = urlData.shortUrl;
        clickCountSpan.textContent = urlData.clickCount;
        createdDateSpan.textContent = formatDate(urlData.createdAt);
        
        visitLink.href = urlData.shortUrl;
        statsLink.href = `/${urlData.shortSlug}/stats`;

        resultSection.style.display = 'block';
        resultSection.classList.add('fade-in');
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Handle URL lookup (dashboard)
async function handleUrlLookup(event) {
    event.preventDefault();
    
    const form = event.target;
    const slug = form.slugInput.value.trim();
    
    if (!slug) {
        showUrlLookupError('Please enter a URL slug');
        return;
    }

    showUrlLookupLoading();

    try {
        const response = await fetch(`/${slug}/stats`);
        const data = await response.json();

        if (data.success) {
            displayUrlStats(data.data, slug);
        } else {
            showUrlNotFound();
        }
    } catch (error) {
        console.error('Error looking up URL:', error);
        showUrlLookupError('Network error. Please try again.');
    }
}

// Display URL statistics
function displayUrlStats(urlData, slug) {
    const detailsSection = document.getElementById('urlDetailsSection');
    const originalUrlDisplay = document.getElementById('originalUrlDisplay');
    const urlClickCount = document.getElementById('urlClickCount');
    const shortUrlDisplay = document.getElementById('shortUrlDisplay');
    const urlCreatedDate = document.getElementById('urlCreatedDate');
    const visitUrlBtn = document.getElementById('visitUrlBtn');

    if (detailsSection && originalUrlDisplay) {
        originalUrlDisplay.textContent = urlData.originalUrl;
        urlClickCount.textContent = urlData.clickCount;
        shortUrlDisplay.value = `${window.location.origin}/${slug}`;
        urlCreatedDate.textContent = formatDate(urlData.createdAt);
        visitUrlBtn.href = `/${slug}`;

        hideUrlLookupMessages();
        detailsSection.style.display = 'block';
        detailsSection.classList.add('fade-in');
    }
}

// Copy URL to clipboard
async function handleCopyUrl() {
    const shortUrlInput = document.getElementById('shortUrl');
    if (shortUrlInput) {
        try {
            await navigator.clipboard.writeText(shortUrlInput.value);
            showCopySuccess('copyBtn');
        } catch (error) {
            fallbackCopy(shortUrlInput.value);
        }
    }
}

// Copy URL from stats page
async function handleCopyUrlFromStats() {
    const shortUrlDisplay = document.getElementById('shortUrlDisplay');
    if (shortUrlDisplay) {
        try {
            await navigator.clipboard.writeText(shortUrlDisplay.value);
            showCopySuccess('copyUrlBtn');
        } catch (error) {
            fallbackCopy(shortUrlDisplay.value);
        }
    }
}

// Fallback copy method
function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showCopySuccess();
}

// Show copy success feedback
function showCopySuccess(buttonId = 'copyBtn') {
    const button = document.getElementById(buttonId);
    if (button) {
        const originalContent = button.innerHTML;
        button.classList.add('copy-success');
        button.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            button.classList.remove('copy-success');
            button.innerHTML = originalContent;
        }, 2000);
    }
    
    showToast('URL copied to clipboard!', 'success');
}

// Generate QR code
function handleGenerateQR() {
    const shortUrlInput = document.getElementById('shortUrl');
    if (shortUrlInput && shortUrlInput.value) {
        generateQRCode(shortUrlInput.value);
    }
}

// Generate QR code from stats
function handleGenerateQRFromStats() {
    const shortUrlDisplay = document.getElementById('shortUrlDisplay');
    if (shortUrlDisplay && shortUrlDisplay.value) {
        generateQRCode(shortUrlDisplay.value);
    }
}

// Generate QR code modal
function generateQRCode(url) {
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    if (qrCodeContainer) {
        qrCodeContainer.innerHTML = `
            <div class="qr-code-container">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" 
                     alt="QR Code" class="img-fluid">
            </div>
        `;
        
        const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
        qrModal.show();
    }
}

// Load recent URLs
async function loadRecentUrls() {
    const container = document.getElementById('recentUrlsContainer');
    if (!container) return;

    try {
        showLoadingState(container, 'Loading recent URLs...');
        
        const response = await fetch('/api/urls/recent?limit=6');
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            recentUrls = data.data;
            displayUrls(container, recentUrls, 'recent');
        } else {
            showEmptyState(container, 'No URLs found', 'Create your first short URL above!');
        }
    } catch (error) {
        console.error('Error loading recent URLs:', error);
        showErrorState(container, 'Failed to load recent URLs');
    }
}

// Load popular URLs
async function loadPopularUrls() {
    const container = document.getElementById('popularUrlsContainer');
    if (!container) return;

    try {
        showLoadingState(container, 'Loading popular URLs...');
        
        const response = await fetch('/api/urls/popular?limit=10');
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            popularUrls = data.data;
            displayPopularUrls(container, popularUrls);
        } else {
            showEmptyState(container, 'No popular URLs yet', 'URLs with clicks will appear here');
        }
    } catch (error) {
        console.error('Error loading popular URLs:', error);
        showErrorState(container, 'Failed to load popular URLs');
    }
}

// Load system statistics
async function loadSystemStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        if (data.success) {
            systemStats = data.data;
            displaySystemStats(systemStats);
        }
    } catch (error) {
        console.error('Error loading system stats:', error);
    }
}

// Display URLs in grid format
function displayUrls(container, urls, type) {
    const urlCards = urls.map(url => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card url-card h-100">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0 text-truncate fw-bold">
                            <i class="fas fa-link me-2 text-primary"></i>
                            <a href="/${url.shortSlug}/stats" class="text-decoration-none text-dark stretched-link">
                                /${url.shortSlug}
                            </a>
                        </h6>
                        <span class="click-badge">${url.clickCount}</span>
                    </div>
                    <p class="card-text url-text text-muted small mb-3" title="${url.originalUrl}">
                        ${truncateUrl(url.originalUrl, 50)}
                    </p>
                    <div class="d-flex justify-content-between align-items-center mt-auto">
                        <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>
                            ${formatRelativeTime(url.createdAt)}
                        </small>
                        <a href="/${url.shortSlug}" class="btn btn-sm btn-outline-primary" target="_blank" title="Visit URL">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = urlCards;
    container.classList.add('fade-in');
}

// Display popular URLs in list format
function displayPopularUrls(container, urls) {
    const urlList = urls.map((url, index) => `
        <a href="/${url.shortSlug}/stats" class="text-decoration-none">
            <div class="popular-url-item d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center flex-grow-1 overflow-hidden">
                    <div class="rank-badge flex-shrink-0 me-3">
                        ${index + 1}
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <h6 class="mb-0 fw-bold text-primary text-truncate">/${url.shortSlug}</h6>
                        <p class="mb-0 text-muted small url-text text-truncate" title="${url.originalUrl}">
                            ${truncateUrl(url.originalUrl, 60)}
                        </p>
                    </div>
                </div>
                <div class="ms-3 text-end flex-shrink-0">
                    <div class="click-badge">${url.clickCount} clicks</div>
                </div>
            </div>
        </a>
    `).join('');

    container.innerHTML = urlList;
    container.classList.add('fade-in');
}

// Display system statistics
function displaySystemStats(stats) {
    const totalUrlsEl = document.getElementById('totalUrls');
    const totalClicksEl = document.getElementById('totalClicks');
    const avgClicksEl = document.getElementById('avgClicksPerUrl');
    const systemUptimeEl = document.getElementById('systemUptime');

    if (totalUrlsEl) {
        totalUrlsEl.innerHTML = formatNumber(stats.totalUrls);
    }
    if (totalClicksEl) {
        totalClicksEl.innerHTML = formatNumber(stats.totalClicks);
    }
    if (avgClicksEl) {
        const avgClicks = stats.totalUrls > 0 ? (stats.totalClicks / stats.totalUrls).toFixed(1) : '0';
        avgClicksEl.innerHTML = avgClicks;
    }
    if (systemUptimeEl) {
        // This would need to be passed from the server
        systemUptimeEl.innerHTML = 'Online';
    }
}

// View URL statistics
function viewUrlStats(slug) {
    if (window.location.pathname === '/dashboard') {
        // On dashboard page, populate the lookup form
        const slugInput = document.getElementById('slugInput');
        if (slugInput) {
            slugInput.value = slug;
            document.getElementById('urlLookupForm').dispatchEvent(new Event('submit'));
        }
    } else {
        // Redirect to stats page
        window.location.href = `/${slug}/stats`;
    }
}

// Utility functions
function showLoadingState(container, message = 'Loading...') {
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-custom mx-auto"></div>
            <p class="text-muted mt-3">${message}</p>
        </div>
    `;
}

function showEmptyState(container, title, message) {
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="mb-3">
                <i class="fas fa-inbox fa-4x text-gray-300"></i>
            </div>
            <h5 class="fw-bold text-gray-600">${title}</h5>
            <p class="text-muted">${message}</p>
        </div>
    `;
}

function showErrorState(container, message) {
    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="mb-3">
                <i class="fas fa-exclamation-triangle fa-4x text-warning"></i>
            </div>
            <h5 class="fw-bold text-danger">Error</h5>
            <p class="text-muted">${message}</p>
        </div>
    `;
}

function showError(message) {
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    if (errorSection && errorMessage) {
        errorMessage.textContent = message;
        errorSection.style.display = 'block';
        errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function hideError() {
    const errorSection = document.getElementById('errorSection');
    if (errorSection) {
        errorSection.style.display = 'none';
    }
}

function showUrlLookupLoading() {
    hideUrlLookupMessages();
    const container = document.getElementById('urlDetailsSection');
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-custom mx-auto"></div>
            <p class="text-muted mt-3">Looking up URL...</p>
        </div>
    `;
    container.style.display = 'block';
}

function showUrlNotFound() {
    hideUrlLookupMessages();
    document.getElementById('urlNotFoundSection').style.display = 'block';
}

function showUrlLookupError(message) {
    hideUrlLookupMessages();
    const errorMessageEl = document.getElementById('urlLookupErrorMessage');
    if (errorMessageEl) {
        errorMessageEl.textContent = message;
        document.getElementById('urlLookupError').style.display = 'block';
    }
}

function hideUrlLookupMessages() {
    const sections = ['urlDetailsSection', 'urlNotFoundSection', 'urlLookupError'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeTime(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return formatDate(dateString);
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
}

function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check' : 'exclamation-triangle'} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Show toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();

    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
} 